import { flushSync } from 'react-dom'

// Blank space at the end of the page, so collapsing something near the
// bottom doesn't make the browser clamp the scroll position and shift the
// page down under the pointer.
let spacer = null

function getSpacer() {
  if (spacer === null) {
    spacer = document.createElement('div')
    spacer.setAttribute('aria-hidden', 'true')
    document.body.append(spacer)
    window.addEventListener('scroll', trimSpacer, { passive: true })
  }
  return spacer
}

// Keeps only the part of the spacer that's on screen. Shrinking the part
// below the viewport doesn't move anything visible, so the extra space
// disappears as the user scrolls back up.
function trimSpacer() {
  const visible = Math.max(0, window.innerHeight - spacer.getBoundingClientRect().top)
  if (visible < spacer.offsetHeight) spacer.style.height = `${visible}px`
}

// Applies a React state update (e.g. expanding or collapsing a row) while
// keeping `element` at the same spot on screen, so the user can toggle it
// again without moving the pointer.
export function keepInPlace(element, update) {
  const before = element.getBoundingClientRect().top
  flushSync(update)
  const drift = element.getBoundingClientRect().top - before
  if (drift <= 0) return

  const space = getSpacer()
  space.style.height = `${space.offsetHeight + drift}px`
  window.scrollBy(0, drift)
}
