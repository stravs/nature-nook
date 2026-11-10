export {};

const copy = document.querySelector<HTMLButtonElement>('#copy-link');
const print = document.querySelector<HTMLButtonElement>('#print-guide');
const status = document.querySelector<HTMLElement>('#share-status');

if (copy && print && status) {
  copy.classList.replace('hidden', 'inline-flex');
  print.classList.replace('hidden', 'inline-flex');
  print.addEventListener('click', () => window.print());
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.url!);
      status.textContent = 'Guide link copied.';
    } catch {
      status.textContent = 'Could not copy automatically. Select and copy the guide link above.';
      const link = document.querySelector('#guide-url');
      if (link) {
        const range = document.createRange();
        range.selectNodeContents(link);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  });
}
