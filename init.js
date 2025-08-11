const tg = window.Telegram?.WebApp;
const IS_TG = !!tg;
const IS_IOS_TG = IS_TG && tg.platform === 'ios';

function applySafeArea(){
  if (!window.Telegram?.WebApp) return;              // снаружи Telegram — ничего не менять
  const tg = window.Telegram.WebApp;
  const vh = (tg.viewportHeight || window.innerHeight);
  document.documentElement.style.setProperty('--vh', vh + 'px');
  // iOS header бывает плавающим — env(safe-area-*) + запас
  const extraTop = tg.platform === 'ios' ? 6 : 0;
  document.documentElement.style.setProperty('--safe-top', `calc(env(safe-area-inset-top,0px) + ${extraTop}px)`);
}

function flipIfOverflow(el){
  const r = el.getBoundingClientRect();
  if (r.right > window.innerWidth - 8) el.classList.add('align-left'); else el.classList.remove('align-left');
}

tg?.ready();
tg?.expand();
tg?.onEvent?.('viewportChanged', applySafeArea);
window.addEventListener('resize', applySafeArea);
applySafeArea();
