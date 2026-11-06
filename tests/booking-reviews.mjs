import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

for (const [path, score, country, hint] of [
  ['dist/index.html', '9.5', 'Ireland', 'Swipe to read all three reviews'],
  ['dist/sl/index.html', '9,5', 'Irska', 'Podrsajte za vsa tri mnenja'],
]) {
  const { document } = parseHTML(await readFile(path, 'utf8'));
  const reviews = document.querySelector('#reviews');
  assert.ok(document.querySelector('.hero-card').textContent.includes(score));
  assert.equal(reviews.querySelector('.outline-button'), null);
  assert.ok(!reviews.textContent.includes('Read what guests have shared'));
  assert.ok(reviews.textContent.includes(country));
  assert.ok(reviews.textContent.includes(hint));
  const cards = [...reviews.querySelectorAll('figure')];
  assert.equal(cards.length, 3);
  for (const [index, author] of ['Aleksandar', 'Sarah', 'Catherine'].entries()) {
    assert.ok(cards[index].querySelector('figcaption').textContent.includes(author));
    assert.equal(cards[index].querySelector('blockquote').lang, 'en');
    assert.ok(cards[index].querySelector('time').getAttribute('datetime'));
    assert.ok(cards[index].classList.contains('tw:snap-start'));
    const source = cards[index].querySelector('figcaption a');
    assert.equal(source.getAttribute('href'), 'https://www.booking.com/hotel/si/nature-nook.html#tab-reviews');
    assert.equal(source.getAttribute('target'), '_blank');
    assert.equal(source.getAttribute('rel'), 'noopener noreferrer');
  }
  assert.ok(cards[2].textContent.includes('A bit more work space in the kitchen would be good, between the fridge and hob.'));
  const scroller = reviews.querySelector('[role="region"]');
  assert.equal(scroller.getAttribute('tabindex'), '0');
  for (const cls of ['tw:overflow-x-auto', 'tw:snap-x', 'tw:snap-mandatory', 'tw:md:grid-cols-3']) {
    assert.ok(scroller.classList.contains(cls));
  }
  console.log(`${path}: three attributed reviews, dates, original English, kitchen note and native swipe markup passed`);
}
