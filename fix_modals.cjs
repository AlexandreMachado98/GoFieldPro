const fs = require('fs');
const file = 'src/components/PdfMaps/PdfMapNavigator.tsx';
let code = fs.readFileSync(file, 'utf8');

// There are several modals in PdfMapNavigator.tsx like:
// {isMapsListOpen && ( <div className="fixed inset-0 ...> ... </div> )}
// We can use a regex that matches {someState && ( <div className="fixed inset-0 z-[200] ... )}
// Wait, matching the closing div is hard with regex. 

// Let's use string manipulation for each specific modal.
const modalStates = [
  'isMapsListOpen',
  'isTrackModalOpen',
  'isProcessing',
  'pendingMarkerPos',
  'isMeasureSummaryOpen',
  'selectedMeasurePointForEdit'
];

modalStates.forEach(state => {
  const search = `{${state} && (\n        <div className="fixed inset-0`;
  const search2 = `{${state} && (\n          <div className="fixed inset-0`; // for 10 spaces
  if (code.includes(search) || code.includes(search2)) {
    console.log('Found modal for', state);
  }
});

// Since the file is 4800 lines, I will just write a function that finds `{someState && (` 
// then finds the matching `)}` and wraps the inside with `createPortal(..., document.body)`.

function wrapWithPortal(stateName) {
  const searchStr = `{${stateName} && (`;
  let idx = code.indexOf(searchStr);
  if (idx === -1) return;
  
  let startIdx = idx + searchStr.length;
  // find the matching closing parentesis for the opening one.
  let openCount = 1;
  let endIdx = startIdx;
  while(openCount > 0 && endIdx < code.length) {
    if (code[endIdx] === '(') openCount++;
    if (code[endIdx] === ')') openCount--;
    endIdx++;
  }
  
  // The content between startIdx and endIdx-1 is the JSX.
  let jsx = code.substring(startIdx, endIdx - 1);
  if (jsx.includes('createPortal')) return; // already wrapped
  
  let newJsx = `\n        createPortal(${jsx}, document.body)\n      `;
  code = code.substring(0, startIdx) + newJsx + code.substring(endIdx - 1);
  console.log(`Wrapped ${stateName}`);
}

wrapWithPortal('isMapsListOpen');
wrapWithPortal('isTrackModalOpen');
// isProcessing has `isProcessing && (`
wrapWithPortal('isProcessing');
wrapWithPortal('pendingMarkerPos');
wrapWithPortal('isMeasureSummaryOpen');
wrapWithPortal('selectedMeasurePointForEdit');

// There's also `isCalibrationModalOpen && (`
wrapWithPortal('isCalibrationModalOpen');

// And what about <PdfExportModal>?
// It's rendered as:
// {isExportModalOpen && (
//   <PdfExportModal
//     ...
//   />
// )}
// This component internally is a modal, BUT the component itself might not have createPortal.
// Let's wrap it in createPortal too just in case.
// Wait, `PdfExportModal` internally has `<div className="fixed inset-0...`. 
// We should edit `PdfExportModal.tsx` itself instead.

fs.writeFileSync(file, code);
console.log('Done');
