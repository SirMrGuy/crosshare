/** @jsx jsx */
import { jsx } from '@emotion/core';

import * as React from 'react';

import { isMobile, isTablet } from "react-device-detect";
import { FaRegCircle, FaRegCheckCircle, FaTabletAlt, FaKeyboard, FaEllipsisH, } from 'react-icons/fa';
import { IoMdStats } from 'react-icons/io';
import useEventListener from '@use-it/event-listener';

import {
  Rebus, SpinnerWorking, SpinnerFinished, SpinnerFailed, SpinnerDisabled,
  SymmetryIcon, SymmetryRotational, SymmetryVertical, SymmetryHorizontal, SymmetryNone,
} from './Icons';
import { requiresAdmin } from './App';
import { Grid, GridData } from './Grid';
import { PosAndDir, Direction, PuzzleJson } from './types';
import {
  Symmetry, builderReducer, validateGrid,
  KeypressAction, SymmetryAction } from './reducer';
import { TopBarLink, TopBar, TopBarDropDownLink, TopBarDropDown } from './TopBar';
import { SquareAndCols, TinyNav, Page } from './Page';
import { RebusOverlay, getKeyboardHandler, getPhysicalKeyboardHandler } from './Puzzle';
import AutofillWorker from 'worker-loader!./autofill.worker.ts'; // eslint-disable-line import/no-webpack-loader-syntax
import { isAutofillCompleteMessage, isAutofillResultMessage, WorkerMessage, LoadDBMessage, AutofillMessage } from './types';
import * as WordDB from './WordDB';

let worker: Worker;

export const BuilderDBLoader = requiresAdmin((props: PuzzleJson) => {
  if (localStorage.getItem("db")) {
    return <Builder {...props}/>;
  }
  return <Builder {...props}/>;
});

export const Builder = (props: PuzzleJson) => {
  const [state, dispatch] = React.useReducer(builderReducer, {
    active: { col: 0, row: 0, dir: Direction.Across } as PosAndDir,
    grid: GridData.fromCells(
      props.size.cols,
      props.size.rows,
      props.grid,
      true,
      props.clues.across,
      props.clues.down,
      new Set(props.highlighted),
      props.highlight,
    ),
    showKeyboard: isMobile,
    isTablet: isTablet,
    showExtraKeyLayout: false,
    isEnteringRebus: false,
    rebusValue: '',
    wrongCells: new Set<number>(),
    gridIsComplete: false,
    repeats: new Set<string>(),
    hasNoShortWords: false,
    isEditable: () => true,
    symmetry: Symmetry.Rotational,
    postEdit(_cellIndex) {
      return validateGrid(this);
    }
  }, validateGrid);

  const [autofilledGrid, setAutofilledGrid] = React.useState<string[]>([]);
  const [autofillInProgress, setAutofillInProgress] = React.useState(false);

  // TODO should we actually disable autofill? Right now it just turns off display
  const [autofillEnabled, setAutofillEnabled] = React.useState(true);
  WordDB.initialize();
  if (WordDB.dbStatus === WordDB.DBStatus.notPresent) {
    WordDB.build();
  }

  React.useEffect(() => {
    if (!WordDB.db) {
      return;
    }
    setAutofilledGrid([]);
    if (!worker) {
      console.log("initializing worker");
      worker = new AutofillWorker();
      worker.onmessage = e => {
        const data = e.data as WorkerMessage;
        if (isAutofillResultMessage(data)) {
          setAutofilledGrid(data.result);
        } else if (isAutofillCompleteMessage(data)) {
          setAutofillInProgress(false);
        } else {
          console.error("unhandled msg in builder: ", e.data);
        }
      };
      let loaddb: LoadDBMessage = {type: 'loaddb', db: WordDB.db};
      worker.postMessage(loaddb);
    }
    let autofill: AutofillMessage = {
      type: 'autofill',
      grid: state.grid.cells,
      width: state.grid.width,
      height: state.grid.height
    };
    setAutofillInProgress(true);
    worker.postMessage(autofill);
  }, [state.grid.cells, state.grid.width, state.grid.height]);

  useEventListener('keydown', getPhysicalKeyboardHandler(dispatch));

  if (WordDB.dbStatus === WordDB.DBStatus.building || WordDB.dbStatus === WordDB.DBStatus.uninitialized) {
    return <Page>Loading word database...</Page>
  }

  function toggleAutofillEnabled() {
    setAutofillEnabled(a => !a);
  }

  let autofillIcon = <SpinnerDisabled/>;
  let autofillText = "Autofill disabled";
  if (autofillEnabled) {
    if (autofillInProgress) {
      autofillIcon = <SpinnerWorking/>;
      autofillText = "Autofill in progress";
    } else if (autofilledGrid.length) {
      autofillIcon = <SpinnerFinished/>;
      autofillText = "Autofill complete";
    } else {
      autofillIcon = <SpinnerFailed/>;
      autofillText = "Couldn't autofill this grid";
    }
  }
  return (
    <React.Fragment>
      <TopBar>
        <TopBarLink icon={autofillIcon} text="Autofill" hoverText={autofillText} onClick={toggleAutofillEnabled} />
        <TopBarDropDown icon={<IoMdStats/>} text="Stats">
          <h4 css={{width: '100%'}}>Grid status</h4>
          <ul css={{textAlign: 'left'}}>
            <li>All cells should be filled { state.gridIsComplete ? <FaRegCheckCircle/> : <FaRegCircle/> }</li>
            <li>All entries should be at least three letters { state.hasNoShortWords ? <FaRegCheckCircle/> : <FaRegCircle/> }</li>
            <li>No entries should be repeated { state.repeats.size > 0 ? <React.Fragment><FaRegCircle/> ({Array.from(state.repeats).sort().join(", ")})</React.Fragment>: <FaRegCheckCircle/> }</li>
          </ul>
        </TopBarDropDown>
        <TopBarDropDown icon={<SymmetryIcon type={state.symmetry}/>} text="Symmetry">
          <TopBarDropDownLink icon={<SymmetryRotational />} text="Rotational Symmetry" onClick={() => dispatch({ type: "CHANGESYMMETRY", symmetry: Symmetry.Rotational } as SymmetryAction)} />
          <TopBarDropDownLink icon={<SymmetryHorizontal />} text="Horizontal Symmetry" onClick={() => dispatch({ type: "CHANGESYMMETRY", symmetry: Symmetry.Horizontal } as SymmetryAction)} />
          <TopBarDropDownLink icon={<SymmetryVertical />} text="Vertical Symmetry" onClick={() => dispatch({ type: "CHANGESYMMETRY", symmetry: Symmetry.Vertical } as SymmetryAction)} />
          <TopBarDropDownLink icon={<SymmetryNone />} text="No Symmetry" onClick={() => dispatch({ type: "CHANGESYMMETRY", symmetry: Symmetry.None } as SymmetryAction)} />
        </TopBarDropDown>
        <TopBarDropDown icon={<FaEllipsisH />} text="More">
          <TopBarDropDownLink icon={<Rebus />} text="Enter Rebus (Esc)" onClick={() => dispatch({ type: "KEYPRESS", key: 'Escape', shift: false } as KeypressAction)} />
          <TopBarDropDownLink icon={<FaKeyboard />} text="Toggle Keyboard" onClick={() => dispatch({ type: "TOGGLEKEYBOARD" })} />
          <TopBarDropDownLink icon={<FaTabletAlt />} text="Toggle Tablet" onClick={() => dispatch({ type: "TOGGLETABLET" })} />
        </TopBarDropDown>
      </TopBar>
      {state.isEnteringRebus ?
        <RebusOverlay showingKeyboard={state.showKeyboard} dispatch={dispatch} value={state.rebusValue} /> : ""}
      <SquareAndCols
        showKeyboard={state.showKeyboard}
        keyboardHandler={getKeyboardHandler(dispatch)}
        showExtraKeyLayout={state.showExtraKeyLayout}
        isTablet={state.isTablet}
        includeBlockKey={true}
        square={
          <Grid
            showingKeyboard={state.showKeyboard}
            grid={state.grid}
            active={state.active}
            dispatch={dispatch}
            allowBlockEditing={true}
            autofill={autofillEnabled ? autofilledGrid : []}
          />
        }
        left={
          <p>left</p>
        }
        right={<p>right</p>}
        tinyColumn={<TinyNav dispatch={dispatch}>tiny</TinyNav>}
      />
    </React.Fragment>
  )
}
