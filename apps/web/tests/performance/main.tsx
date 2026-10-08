import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../../src/app/styles/theme.css';
import '../../src/app/styles/styles.css';
import { runEngineSuite, runLifecycleSuite, runStressComparison } from './engine-suite';
import {
  runEditorSuite,
  runSnapshotComparison,
  runEmptyEditor,
  showInteractiveEditor,
  runInteractionChecks,
} from './editor-suite';
import { environment, publish, records } from './metrics';
import './performance.css';

const buttons = document.querySelectorAll<HTMLButtonElement>('#controls button');
for (const [id, run] of [
  ['engine', runEngineSuite],
  ['editor', runEditorSuite],
  ['lifecycle', runLifecycleSuite],
  ['snapshot', runSnapshotComparison],
  ['stress', runStressComparison],
  ['empty', runEmptyEditor],
  ['interactive', showInteractiveEditor],
  ['checks', runInteractionChecks],
] as const) {
  document.querySelector(`#${id}`)!.addEventListener('click', async () => {
    buttons.forEach((button) => {
      button.disabled = true;
    });
    document.querySelector('#status')!.setAttribute('data-state', 'running');
    try {
      await run();
      document.querySelector('#status')!.textContent = `Complete: ${records.length} cases`;
      document.querySelector('#status')!.setAttribute('data-state', 'complete');
    } catch (error) {
      const message = error instanceof Error ? error.stack : String(error);
      environment.error = message;
      document.querySelector('#status')!.textContent = `FAILED: ${message}`;
      document.querySelector('#status')!.setAttribute('data-state', 'failed');
    } finally {
      publish();
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  });
}
