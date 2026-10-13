import { readPacks, removePack, clearOffline } from './offline-store.js';
const root = document.getElementById('packs'), status = document.getElementById('status');
let generation = 0;
const urls = new Set();
function clearView() {
  generation++;
  root.replaceChildren();
  urls.forEach(url => URL.revokeObjectURL(url)); urls.clear();
}
function node(tag, text, parent) {
  const el = document.createElement(tag); el.textContent = text; parent.append(el); return el;
}
async function render() {
  clearView(); const version = generation;
  try {
    const packs = await readPacks();
    if (version !== generation) return;
    status.textContent = (navigator.onLine ? 'Online' : 'Offline') + ' · ' + packs.length + ' saved trip(s)';
    for (const pack of packs) {
      const card = node('article', '', root), timeline = pack.timeline;
      node('h2', timeline.tripName, card);
      node('p', timeline.destination, card);
      node('small', 'Saved ' + new Date(pack.savedAt).toLocaleString(), card);
      const remove = node('button', 'Remove this offline trip', card);
      remove.onclick = async () => { try { await removePack(pack.key); await render(); } catch { status.textContent = 'Could not remove the saved trip. Try again.'; } };
      for (const day of timeline.days) {
        const section = node('section', '', card); section.className = 'day';
        node('h3', day.formattedDate + ' · ' + day.title, section);
        if (!day.items.length) node('p', 'Nothing planned for this day.', section);
        for (const item of day.items) {
          const row = node('div', '', section); row.className = 'event';
          node('strong', (item.flexible ? 'Flexible' : item.timeFormatted || 'Time not set') + ' · ' + item.title, row);
          node('small', item.sourceType === 'BOOKING' ? 'Booking · ' + item.status : 'Planned activity', row);
          if (item.endDatetime && !item.flexible) node('small', 'Ends ' + item.endDatetime.replace('T', ' '), row);
          if (item.location) node('p', item.location, row);
          if (item.bookingReference) node('small', 'Reference: ' + item.bookingReference, row);
          if (item.warning) node('p', item.warning, row).className = 'warning';
          if (item.notes) node('pre', item.notes, row);
        }
      }
      node('h3', 'Saved documents', card);
      if (!pack.documents.length) node('p', 'No documents selected for this trip.', card);
      for (const doc of pack.documents) {
        const url = URL.createObjectURL(doc.blob); urls.add(url);
        const link = node('a', 'Download ' + doc.name, card);
        link.href = url; link.download = doc.name; // Download only; do not execute uploaded HTML/SVG.
      }
    }
  } catch (error) { if (version === generation) status.textContent = error.message || 'Offline storage is unavailable in this browser.'; }
}
document.getElementById('reload').onclick = render;
document.getElementById('clear').onclick = async () => {
  clearView();
  try { await clearOffline(); status.textContent = 'Offline data removed.'; }
  catch { status.textContent = 'Offline access cleared. Clear browser site data to remove any remaining files.'; }
};
window.addEventListener('storage', render);
window.addEventListener('online', render);
window.addEventListener('offline', render);
render();
