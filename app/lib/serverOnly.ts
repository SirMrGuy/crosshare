import { getAdminApp, mapEachResult } from '../lib/firebaseAdminWrapper';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import {
  puzzleFromDB,
  Comment,
  PuzzleResultWithAugmentedComments,
  Direction,
} from './types';
import type firebaseAdminType from 'firebase-admin';

import { isRight } from 'fp-ts/lib/Either';
import { PathReporter } from 'io-ts/lib/PathReporter';
import { DBPuzzleV, CommentWithRepliesT } from './dbtypes';
import {
  ConstructorPageV,
  ConstructorPageWithMarkdown,
} from './constructorPage';
import { NextPuzzleLink } from '../components/Puzzle';
import { GetServerSideProps } from 'next';
import { EmbedOptionsT } from './embedOptions';
import { ArticleT, validate } from './article';
import { isUserPatron } from './patron';
import { addDays } from 'date-fns';
import { isSome } from 'fp-ts/lib/Option';
import { getMiniForDate } from './dailyMinis';
import { slugify } from './utils';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Root } from 'hast';
import { markdownToHast } from './markdown/markdown';
import { addClues, fromCells, getEntryToClueMap } from './viewableGrid';

export async function getStorageUrl(
  storageKey: string
): Promise<string | null> {
  const profilePic = getStorage(getAdminApp()).bucket().file(storageKey);
  if ((await profilePic.exists())[0]) {
    try {
      if (process.env.NEXT_PUBLIC_USE_EMULATORS) {
        return profilePic.publicUrl();
      }
      return (
        await profilePic.getSignedUrl({
          action: 'read',
          expires: '03-09-2491',
        })
      )[0];
    } catch (e) {
      console.log('error getting profile pic', storageKey, e);
    }
  } else {
    console.log('pic doesnt exist', storageKey);
  }
  return null;
}

const usernameMap: Record<string, ConstructorPageWithMarkdown> = {};
let usernamesUpdated: number | null = null;
const usernamesTTL = 1000 * 60 * 10;

const updateUsernameMap = async (): Promise<void> => {
  const now = Date.now();
  console.log('updating username map');
  const db = getFirestore(getAdminApp());
  let query: firebaseAdminType.firestore.Query = db.collection('cp');
  if (usernamesUpdated) {
    query = query.where('t', '>=', AdminTimestamp.fromMillis(usernamesUpdated));
  }
  try {
    await mapEachResult(query, ConstructorPageV, (cp, docId) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { t, ...partial } = cp;
      const { sig, ...res } = {
        ...partial,
        id: docId,
        b: markdownToHast({ text: partial.b }),
      };
      usernameMap[cp.u] = {
        ...res,
        ...(sig !== undefined && { sig: markdownToHast({ text: sig }) }),
      };
    });
    usernamesUpdated = now;
  } catch (e) {
    console.error('error updating constructor pages');
    console.error(e);
  }
};

let updateUsernameMapPromise: Promise<void> | null = null;
const updateUsernameMapOnce = () => {
  if (!updateUsernameMapPromise) {
    updateUsernameMapPromise = updateUsernameMap().finally(() => {
      updateUsernameMapPromise = null;
    });
  }
  return updateUsernameMapPromise;
};

export async function userIdToPage(
  userId: string
): Promise<ConstructorPageWithMarkdown | null> {
  if (
    usernamesUpdated === null ||
    Date.now() - usernamesUpdated > usernamesTTL
  ) {
    await updateUsernameMapOnce();
  }
  return usernameMap[userId] || null;
}

export async function getArticle(
  slug: string
): Promise<string | ArticleT | null> {
  const db = getFirestore(getAdminApp());
  let dbres;
  try {
    dbres = await db.collection('a').where('s', '==', slug).get();
  } catch {
    return 'error getting article';
  }
  return validate(dbres.docs[0]?.data());
}

export interface PageErrorProps {
  error: string;
}

export type ArticlePageProps = PageErrorProps | (ArticleT & { hast: Root });

export const getArticlePageProps: GetServerSideProps<
  ArticlePageProps
> = async ({ res, params }): Promise<{ props: ArticlePageProps }> => {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!params?.slug || Array.isArray(params.slug)) {
    res.statusCode = 404;
    return { props: { error: 'bad article params' } };
  }
  const article = await getArticle(params.slug);
  if (typeof article === 'string') {
    return { props: { error: article } };
  }
  if (!article) {
    res.statusCode = 404;
    return { props: { error: 'article doesnt exist' } };
  }
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
  return { props: { ...article, hast: markdownToHast({ text: article.c }) } };
};

export async function convertComments(
  comments: Array<CommentWithRepliesT>,
  clueMap: Map<string, [number, Direction, string]>
): Promise<Array<Comment>> {
  return Promise.all(
    comments.map(async (c) => {
      return {
        commentText: c.c,
        commentHast: markdownToHast({ text: c.c, clueMap }),
        authorId: c.a,
        authorDisplayName: c.n,
        authorSolveTime: c.t,
        authorCheated: c.ch,
        authorSolvedDownsOnly: c.do || false,
        publishTime: c.p.toMillis(),
        id: c.i,
        replies: await convertComments(c.r || [], clueMap),
        ...(c.un && { authorUsername: c.un }),
        authorIsPatron: await isUserPatron(c.a),
      };
    })
  );
}

export interface PuzzlePageResultProps {
  puzzle: PuzzleResultWithAugmentedComments;
  profilePicture?: string | null;
  coverImage?: string | null;
  nextPuzzle?: NextPuzzleLink;
  embedOptions?: EmbedOptionsT;
}

export type PuzzlePageProps = PuzzlePageResultProps | PageErrorProps;

export const getPuzzlePageProps: GetServerSideProps<PuzzlePageProps> = async ({
  res,
  params,
  locale,
}) => {
  const db = getFirestore(getAdminApp());
  let puzzle: PuzzleResultWithAugmentedComments;
  let puzzleId = params?.puzzleId;
  let titleSlug = '';
  if (Array.isArray(puzzleId)) {
    titleSlug = puzzleId[1] || '';
    puzzleId = puzzleId[0];
  }
  //console.log('hi');
  //console.log(puzzleId);
  if (!puzzleId) {
    res.statusCode = 404;
    return { props: { error: 'missing puzzleId' } };
  }
  let dbres;
  try {
    dbres = await db.collection('c').doc(puzzleId).get();
  } catch {
    return { props: { error: 'error getting puzzle' } };
  }
  if (!dbres.exists) {
    res.statusCode = 404;
    return { props: { error: 'puzzle doesnt exist' } };
  }

  const validationResult = DBPuzzleV.decode(dbres.data());
  if (isRight(validationResult)) {
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
    const fromDB = puzzleFromDB(validationResult.right);
    const grid = addClues(
      fromCells({
        mapper: (e) => e,
        width: fromDB.size.cols,
        height: fromDB.size.rows,
        cells: fromDB.grid,
        allowBlockEditing: true,
        highlighted: new Set(fromDB.highlighted),
        highlight: fromDB.highlight,
        vBars: new Set(fromDB.vBars),
        hBars: new Set(fromDB.hBars),
        hidden: new Set(fromDB.hidden),
      }),
      fromDB.clues,
      (c: string) => markdownToHast({ text: c, inline: true })
    );
    const clueMap = getEntryToClueMap(grid, fromDB.grid);
    puzzle = {
      ...fromDB,
      id: dbres.id,
      blogPostRaw: fromDB.blogPost,
      blogPost: fromDB.blogPost
        ? markdownToHast({ text: fromDB.blogPost })
        : null,
      constructorNotes: fromDB.constructorNotes
        ? markdownToHast({ text: fromDB.constructorNotes, inline: true })
        : null,
      constructorPage: await userIdToPage(validationResult.right.a),
      constructorIsPatron: await isUserPatron(validationResult.right.a),
      comments: await convertComments(fromDB.comments, clueMap),
      clueHasts: grid.entries.map((c) =>
        markdownToHast({ text: c.clue, clueMap, inline: true })
      ),
    };
  } else {
    console.error(PathReporter.report(validationResult).join(','));
    return { props: { error: 'invalid puzzle' } };
  }

  // If the title slug is missing or not correct we need to redirect
  const correctSlug = slugify(puzzle.title);
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!params?.ignoreRedirect && titleSlug !== correctSlug) {
    return {
      redirect: {
        destination: `/${
          locale && locale !== 'en' ? locale + '/' : ''
        }crosswords/${puzzle.id}/${correctSlug}`,
        permanent: true,
      },
    };
  }

  let profilePicture: string | null = null;
  let coverImage: string | null = null;
  if (puzzle.constructorPage?.u) {
    profilePicture = await getStorageUrl(
      `users/${puzzle.constructorPage.u}/profile.jpg`
    );
  }
  coverImage = await getStorageUrl(
    `users/${puzzle.authorId}/${puzzle.id}/cover.jpg`
  );

  let nextPuzzle: NextPuzzleLink | null = null;
  const today = new Date();

  if (validationResult.right.dmd) {
    // this puzzle is a daily mini, see if we show a previous instead of today's
    const dt = new Date(validationResult.right.dmd);
    let tryMiniDate = new Date(
      dt.valueOf() - dt.getTimezoneOffset() * 60 * 1000
    );
    if (tryMiniDate <= today) {
      tryMiniDate = addDays(tryMiniDate, -1);
      const puzzle = await getMiniForDate(tryMiniDate);
      if (isSome(puzzle)) {
        nextPuzzle = {
          puzzleId: puzzle.value.id,
          linkText: 'the previous daily mini crossword',
          puzzleTitle: puzzle.value.t,
        };
      }
    }
  }

  if (!nextPuzzle) {
    const puzzle = await getMiniForDate(today);
    if (isSome(puzzle)) {
      nextPuzzle = {
        puzzleId: puzzle.value.id,
        linkText: "today's daily mini crossword",
        puzzleTitle: puzzle.value.t,
      };
    }
  }
  return {
    props: {
      puzzle,
      profilePicture,
      coverImage,
      ...(nextPuzzle && {
        nextPuzzle,
      }),
    },
  };
};
