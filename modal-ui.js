'use strict';
const modalReturnFocus = new Map();
const modalStack = [];
function modalFocusables(modal) {
  return [...modal.querySelectorAll('button, input, select, textarea, summary, a[href], [tabindex]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
}
function fitExpenseViewport(){
 const modal=document.getElementById("expenseModal"),v=window.visualViewport;
 if(modal&&v){modal.style.setProperty("--expense-viewport-height",v.height+"px");modal.style.setProperty("--expense-viewport-top",v.offsetTop+"px");}
}
if(window.visualViewport){window.visualViewport.addEventListener("resize",fitExpenseViewport);window.visualViewport.addEventListener("scroll",fitExpenseViewport);}
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (!modal.classList.contains('open')) modalReturnFocus.set(id, document.activeElement);
  const pos = modalStack.indexOf(id); if (pos >= 0) modalStack.splice(pos,1);
  modalStack.push(id);
  if(id==="expenseModal")fitExpenseViewport();
  modal.classList.add('open');
  modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
  const heading = modal.querySelector('h2, h3');
  if (heading) { heading.id ||= id + 'Heading'; modal.setAttribute('aria-labelledby',heading.id); }
  modal.tabIndex = -1;
  (modalFocusables(modal)[0] || modal).focus();
}
function closeModal(id) {
  const modal = document.getElementById(id); if (!modal) return;
  modal.classList.remove('open');
  const pos = modalStack.indexOf(id); if (pos >= 0) modalStack.splice(pos,1);
  if (id === 'recipeModal' && typeof recipeImportSession !== 'undefined') { cancelRecipeImport(); recipeImportSession++; recipeImportDraft = null; }
  const previous = modalReturnFocus.get(id); modalReturnFocus.delete(id);
  const top = document.getElementById(modalStack.at(-1));
  if (previous?.isConnected && (!top || top.contains(previous))) previous.focus();
  else if (top) (modalFocusables(top)[0] || top).focus();
}
document.addEventListener('click', e => {
  if (e.target.classList?.contains('modal-bg') && e.target.classList.contains('open')) closeModal(e.target.id);
});
document.addEventListener('keydown', e => {
  const modal = document.getElementById(modalStack.at(-1));
  if (!modal?.classList.contains('open')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(modal.id); return; }
  if (e.key !== 'Tab') return;
  const fields = modalFocusables(modal), first = fields[0], last = fields.at(-1);
  if (!first) { e.preventDefault(); modal.focus(); }
  else if (e.shiftKey && (document.activeElement === first || !fields.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !fields.includes(document.activeElement))) { e.preventDefault(); first.focus(); }
});
