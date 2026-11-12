const button = document.querySelector<HTMLButtonElement>('#print-brochure');
const feedback = document.querySelector<HTMLElement>('#brochure-feedback');

if (button) {
  button.hidden = false;
  button.classList.add('inline-flex');
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, image => image.decode().catch(() => undefined)));
      const overflow = Array.from(document.querySelectorAll<HTMLElement>('[data-page-content]'))
        .some(content => content.scrollHeight > content.clientHeight + 1);
      if (overflow) {
        if (feedback) feedback.textContent = 'Some content does not fit. Please use the online guide and ask the owner to shorten the brochure before printing.';
        return;
      }
      window.print();
    } catch {
      if (feedback) feedback.textContent = 'Printing could not open. Use your browser’s Print menu instead.';
    } finally {
      button.disabled = false;
    }
  });
}
