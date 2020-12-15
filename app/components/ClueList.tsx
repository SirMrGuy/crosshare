import {
  useRef,
  Dispatch,
  memo,
  MouseEvent,
  KeyboardEvent,
  RefObject,
} from 'react';

import { Position, Direction } from '../lib/types';
import { CluedEntry, RefPosition } from '../lib/viewableGrid';
import { GridBase, valAt, EntryBase } from '../lib/gridBase';

import { PuzzleAction, ClickedEntryAction } from '../reducers/reducer';
import { SMALL_AND_UP } from '../lib/style';
import { ClueText } from './ClueText';

interface ClueListItemProps {
  dimCompleted: boolean;
  conceal: boolean;
  entry: CluedEntry;
  dispatch: Dispatch<PuzzleAction>;
  isActive: boolean;
  isCross: boolean;
  isRefed: boolean;
  active: Position | null;
  wasEntryClick: boolean;
  showEntry: boolean;
  allEntries?: Array<CluedEntry>;
  refPositions?: Array<Array<RefPosition>>;
  grid: GridBase<EntryBase>;
  scrollToCross: boolean;
  listRef: RefObject<HTMLDivElement>;
}

const ClueListItem = memo(function ClueListItem({
  isActive,
  isCross,
  ...props
}: ClueListItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  if (ref.current && props.listRef.current) {
    if (
      (isActive && !props.wasEntryClick) ||
      (props.scrollToCross && isCross)
    ) {
      props.listRef.current.scrollTop =
        ref.current.offsetTop - props.listRef.current.offsetTop;
    }
  }
  function click(e: MouseEvent | KeyboardEvent) {
    e.preventDefault();
    if (isActive) {
      props.dispatch({ type: 'CHANGEDIRECTION' });
      return;
    }
    const ca: ClickedEntryAction = {
      type: 'CLICKEDENTRY',
      entryIndex: props.entry.index,
    };
    props.dispatch(ca);
  }
  return (
    <li
      css={{
        display: isActive || props.showEntry ? 'list-item' : 'none',
        [SMALL_AND_UP]: {
          display: 'list-item',
        },
        backgroundColor: isActive
          ? 'var(--lighter)'
          : isCross
            ? 'var(--secondary)'
            : props.isRefed
              ? 'var(--reffed)'
              : 'var(--bg)',
        listStyleType: 'none',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: isActive
            ? 'var(--lighter)'
            : isCross
              ? 'var(--secondary-hover)'
              : props.isRefed
                ? 'var(--reffed-hover)'
                : 'var(--bg-hover)',
        },
        width: '100%',
      }}
      ref={ref}
      key={props.entry.index}
    >
      <div
        css={{
          outline: 'none',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          width: '100%',
          padding: '0.5em',
        }}
        role="button"
        tabIndex={0}
        onClick={click}
        onKeyPress={click}
      >
        <div
          css={{
            display: props.showEntry ? 'block' : 'none',
            [SMALL_AND_UP]: {
              display: 'block',
            },
            flexShrink: 0,
            width: '3em',
            height: '100%',
            fontWeight: 'bold',
            textAlign: 'right',
            padding: '0 0.5em',
          }}
        >
          {props.entry.labelNumber}
          <span
            css={{
              [SMALL_AND_UP]: { display: 'none' },
            }}
          >
            {props.entry.direction === Direction.Across ? 'A' : 'D'}
          </span>
        </div>
        <div
          css={{
            flex: '1 1 auto',
            height: '100%',
            color: props.conceal
              ? 'transparent'
              : props.entry.completedWord && props.dimCompleted
                ? 'var(--default-text)'
                : 'var(--black)',
            textShadow: props.conceal ? '0 0 1em var(--conceal-text)' : '',
          }}
        >
          {props.allEntries && props.refPositions ? (
            <ClueText
              refPositions={props.refPositions}
              entryIndex={props.entry.index}
              allEntries={props.allEntries}
              grid={props.grid}
            />
          ) : (
            <div>{props.entry.clue}</div>
          )}
          {props.showEntry ? (
            <div>
              {props.entry.cells.map((a) => {
                return (
                  <span
                    key={a.col + '-' + a.row}
                    css={{
                      display: 'inline-block',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      minWidth: '1em',
                      border:
                        props.active &&
                        a.row === props.active.row &&
                        a.col === props.active.col
                          ? '1px solid var(--black)'
                          : '1px solid transparent',
                    }}
                  >
                    {valAt(props.grid, a).trim() || '-'}
                  </span>
                );
              })}
            </div>
          ) : (
            ''
          )}
        </div>
      </div>
    </li>
  );
});

interface ClueListProps {
  dimCompleted: boolean;
  conceal: boolean;
  header: string;
  current?: number;
  active: Position;
  wasEntryClick: boolean;
  cross?: number;
  refed: Set<number>;
  entries: Array<CluedEntry>;
  allEntries?: Array<CluedEntry>;
  refPositions?: Array<Array<RefPosition>>;
  dispatch: Dispatch<PuzzleAction>;
  showEntries: boolean;
  grid: GridBase<EntryBase>;
  scrollToCross: boolean;
}

export const ClueList = (props: ClueListProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const clues = props.entries.map((entry) => {
    const isActive = props.current === entry.index;
    const isCross = props.cross === entry.index;
    const isRefed = props.refed.has(entry.index);
    return (
      <ClueListItem
        listRef={ref}
        wasEntryClick={props.wasEntryClick}
        scrollToCross={props.scrollToCross}
        dimCompleted={props.dimCompleted}
        grid={props.grid}
        showEntry={props.showEntries}
        allEntries={props.allEntries}
        refPositions={props.refPositions}
        entry={entry}
        conceal={props.conceal}
        key={entry.index}
        dispatch={props.dispatch}
        isActive={isActive}
        isCross={isCross}
        isRefed={isRefed}
        active={
          props.showEntries && (isActive || isCross) ? props.active : null
        }
      />
    );
  });
  return (
    <div
      css={{
        height: '100% !important',
        position: 'relative',
      }}
    >
      <div
        css={{
          display: 'none',
          [SMALL_AND_UP]: {
            display: 'block',
          },
          fontWeight: 'bold',
          borderBottom: '1px solid var(--autofill)',
          height: '1.5em',
          paddingLeft: '0.5em',
          backgroundColor: 'var(--bg)',
        }}
      >
        {props.header}
      </div>
      <div
        ref={ref}
        css={{
          maxHeight: '100%',
          [SMALL_AND_UP]: {
            maxHeight: 'calc(100% - 1.5em)',
          },
          overflowY: 'scroll',
          scrollbarWidth: 'none',
        }}
      >
        <ol
          css={{
            margin: 0,
            padding: 0,
          }}
        >
          {clues}
        </ol>
      </div>
    </div>
  );
};
