/** @jsx jsx */
import { jsx } from '@emotion/core';

import * as React from 'react';

import { navigate, Link, RouteComponentProps } from "@reach/router";

import { requiresAdmin, AuthProps } from './App';
import { Page } from './Page';
import { PuzzleResult, puzzleFromDB, puzzleTitle } from './types';
import { TimestampedPuzzleT, DailyStatsT, DailyStatsV, DBPuzzleV, getDateString } from './common/dbtypes';
import { getFromSessionOrDB, mapEachResult } from './common/dbUtils';
import type { UpcomingMinisCalendarProps } from "./UpcomingMinisCalendar";

const UpcomingMinisCalendar = React.lazy(() => import(/* webpackChunkName: "minisCal" */ './UpcomingMinisCalendar'));

declare var firebase: typeof import('firebase');

const LoadableCalendar = (props: UpcomingMinisCalendarProps) => (
  <React.Suspense fallback={<div>Loading...</div>}>
    <UpcomingMinisCalendar {...props} />
  </React.Suspense>
);

const PuzzleListItem = (props: PuzzleResult) => {
  return (
    <li key={props.id}><Link to={"/crosswords/" + props.id}>{puzzleTitle(props)}</Link> by {props.authorName}</li>
  );
}

export const Admin = requiresAdmin((_: RouteComponentProps & AuthProps) => {
  const [unmoderated, setUnmoderated] = React.useState<Array<PuzzleResult> | null>(null);
  const [stats, setStats] = React.useState<DailyStatsT | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    console.log("loading admin content");
    if (error) {
      console.log("error set, skipping");
      return;
    }
    const db = firebase.firestore();
    mapEachResult(db.collection('c').where("m", "==", false), DBPuzzleV, (dbpuzz, docId) => {
      const forStorage: TimestampedPuzzleT = { downloadedAt: firebase.firestore.Timestamp.now(), data: dbpuzz }
      sessionStorage.setItem('c/' + docId, JSON.stringify(forStorage));
      return { ...puzzleFromDB(dbpuzz), id: docId };
    })
      .then(setUnmoderated)
      .catch(reason => {
        console.error(reason);
        setError(true);
      });

    const now = new Date();
    const dateString = getDateString(now)
    const ttl = 1000 * 60 * 30; // 30min
    getFromSessionOrDB('ds', dateString, DailyStatsV, ttl)
      .then(setStats)
      .catch(reason => {
        console.error(reason);
        setError(true);
      });
  }, [error]);

  const goToPuzzle = React.useCallback((_date: Date, puzzle: string | null) => {
    if (puzzle) {
      navigate("/crosswords/" + puzzle);
    }
  }, []);

  if (error) {
    return <Page title={null}>Error loading admin content</Page>;
  }
  if (unmoderated === null) {
    return <Page title={null}>Loading admin content...</Page>;
  }

  return (
    <Page title="Admin">
      <div css={{ margin: '1em', }}>
        <h4 css={{ borderBottom: '1px solid var(--black)' }}>Unmoderated</h4>
        {unmoderated.length === 0 ?
          <div>No puzzles are currently awaiting moderation.</div>
          :
          <ul>{unmoderated.map(PuzzleListItem)}</ul>
        }
        {stats ?
          <React.Fragment>
            <h4 css={{ borderBottom: '1px solid var(--black)' }}>Today's Stats</h4>
            <div>Total completions: {stats.n}</div>
            <div>Users w/ completions: {stats.u.length}</div>
            <h5>Top Puzzles</h5>
            <ul>
              {Object.entries(stats.c).map(([crosswordId, count]) => {
                return <li key={crosswordId}><Link to={"/crosswords/" + crosswordId}>{crosswordId}</Link>: {count} (<Link to={'/crosswords/' + crosswordId + '/stats'}>stats</Link>)</li>
              })}
            </ul>
          </React.Fragment>
          : ""}
        <h4 css={{ borderBottom: '1px solid var(--black)' }}>Upcoming Minis</h4>

        <LoadableCalendar disableExisting={false} onChange={goToPuzzle} />
      </div>
    </Page>
  );
});
