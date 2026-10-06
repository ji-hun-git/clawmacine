// UI language: English or Korean. Static labels carry data-i18n keys; scripts call I18N.t(key, vars).
// Student and group names are data and are never translated.
window.I18N = (() => {
  const KEY = 'rcc-lang';
  const D = {
    en: {
      'mode.wheel': 'Wheel', 'mode.race': 'Race', 'mode.board': 'Board',
      'btn.spin': 'Spin', 'btn.race': 'Start the race', 'btn.crane': 'To the crane', 'btn.light': 'Light up', 'btn.start': 'START',
      'btn.present': 'Present', 'btn.absent': 'Absent', 'btn.undo': 'Undo',
      'btn.shuffle': 'Shuffle', 'btn.edit': 'Edit names', 'btn.done': 'Done', 'btn.clear': 'Clear marks', 'btn.clear2': 'Press again to clear',
      'btn.load': 'Load roster', 'btn.load2': 'Press again to replace', 'btn.copy': 'Copy picks', 'btn.copied': 'Copied',
      'btn.copylist': 'Copy list', 'btn.again': 'Run again', 'btn.close': 'Close', 'add.name': 'Add name',
      'bar.roster': 'Roster', 'bar.grip': 'Weak grip', 'bar.sound': 'Sound', 'bar.speed': 'Speed', 'bar.full': 'Full screen', 'bar.keys': 'Keys',
      'bar.quality': 'Quality', 'q.auto': 'Auto', 'q.high': 'High', 'q.low': 'Low', 'on': 'on', 'off': 'off', 'bar.lang': '한국어',
      'roster.count': '{p} in {g}',
      'tray.picked': 'PICKED', 'tray.absent': 'Absent', 'plate': 'ROLL CALL',
      'list.order': 'Order', 'list.orderpicks': 'Order and picks', 'list.onwheel': 'On the wheel: {names}',
      'sign.title': 'ROLL CALL CRANE', 'sign.done': 'ROLL CALL DONE', 'board.title': 'Roll call',
      'who.nobody': 'Nobody here', 'who.rollcall': 'Roll call: {name}', 'who.inmachine': 'In the machine',
      's.ready': 'READY', 's.ball': 'BALL IN PLAY', 's.slow': 'TOO SLOW', 's.orderset': 'ORDER SET', 's.raceready': 'RACE READY', 's.raceon': 'RACE ON',
      's.countdown': 'COUNTDOWN', 's.choosing': 'CHOOSING', 's.nograb': 'NO GRAB', 's.slipped': 'SLIPPED', 's.coin': 'COIN IN', 's.chute': 'IN THE CHUTE',
      's.picked': 'PICKED', 's.present': 'PRESENT', 's.absent': 'ABSENT', 's.nobody': 'NOBODY HERE', 's.undone': 'UNDONE', 's.done': 'DONE',
      's.allpicked': 'ALL PICKED', 's.nonames': 'NO NAMES', 's.editing': 'EDITING', 's.lights': 'LIGHTS ON', 's.shuffling': 'SHUFFLING',
      's.need2': 'NEEDS 2 GROUPS', 's.clip': 'CLIPBOARD BLOCKED', 's.onboard': 'ON THE BOARD', 's.wait': 'ONE MOMENT', 's.power': 'POWER ON',
      's.spinfor': 'SPIN FOR {ord}', 's.place': '{ord} · {name}', 's.rostersaved': 'ROSTER SAVED',
      'stamp.present': 'PRESENT', 'stamp.absent': 'ABSENT',
      'n.names': '{n} names', 'n.name': '{n} name', 'n.groups': '{n} groups', 'n.group': '{n} group', 'n.left': '{n} left',
      'n.groupsleft': '{n} groups left', 'n.groupleft': '{n} group left', 'n.leftof': '{left} of {total} left', 'n.cans': '{names} · {cans} cans',
      'pick.n': 'Pick {n}', 'next': 'Next · {name}', 'last.group': 'Last group', 'all.picked': 'All picked',
      's.pressstart': 'START or Space', 'btn.results': 'Results', 'kbd.space': 'Space',
      'ord': ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'],
      'keys.space': 'Spin · Start · Light up · Next', 'keys.p': 'Present', 'keys.a': 'Absent', 'keys.z': 'Undo', 'keys.s': 'Shuffle the board',
      'keys.f': 'Full screen', 'keys.m': 'Sound', 'keys.speed': 'Slower · faster', 'keys.r': 'Roster',
      'copy.crane': 'Roll Call Crane', 'copy.board': 'Roll Call Board', 'copy.nobody': 'nobody here', 'copy.absent': 'absent',
      'race.leads': '{name} leads', 'race.wins': '{name} wins', 'race.photo': 'Photo finish · {name}',
      'r.title': 'Roster', 'r.fewer': 'Fewer groups', 'r.more': 'More groups', 'r.shuffle': 'Shuffle names into groups', 'r.paste': 'Paste a list',
      'r.replace': 'Replace roster', 'r.addto': 'Add to roster', 'r.restore': 'Restore class list', 'r.restore2': 'Click again to replace your list',
      'r.cancel': 'Cancel', 'r.save': 'Save', 'r.saveover': 'Save and start over', 'r.loses': 'Loses {n} picks', 'r.addname': 'Add a name',
      'r.need2': 'The order needs at least 2 groups.', 'r.unsaved': 'Unsaved changes: save them, or press Cancel to drop them.',
      'r.dupes': 'Every name there is already listed.', 'r.nonames': 'No names found in that text.', 'r.here': '{p} here', 'r.absentn': '{n} absent',
      'r.ungrouped': 'Ungrouped',
    },
    ko: {
      'mode.wheel': '룰렛', 'mode.race': '경주', 'mode.board': '보드',
      'btn.spin': '돌리기', 'btn.race': '경주 시작', 'btn.crane': '크레인으로', 'btn.light': '불 켜기', 'btn.start': '시작',
      'btn.present': '출석', 'btn.absent': '결석', 'btn.undo': '되돌리기',
      'btn.shuffle': '섞기', 'btn.edit': '이름 편집', 'btn.done': '완료', 'btn.clear': '표시 지우기', 'btn.clear2': '한 번 더 누르면 지워집니다',
      'btn.load': '명단 불러오기', 'btn.load2': '한 번 더 누르면 바뀝니다', 'btn.copy': '결과 복사', 'btn.copied': '복사됨',
      'btn.copylist': '목록 복사', 'btn.again': '다시 하기', 'btn.close': '닫기', 'add.name': '이름 추가',
      'bar.roster': '명단', 'bar.grip': '약한 집게', 'bar.sound': '소리', 'bar.speed': '속도', 'bar.full': '전체 화면', 'bar.keys': '단축키',
      'bar.quality': '화질', 'q.auto': '자동', 'q.high': '높음', 'q.low': '낮음', 'on': '켜짐', 'off': '꺼짐', 'bar.lang': 'English',
      'roster.count': '{g} · {p}',
      'tray.picked': '뽑힌 이름', 'tray.absent': '결석', 'plate': '출석 부르기',
      'list.order': '순서', 'list.orderpicks': '순서와 뽑힌 이름', 'list.onwheel': '룰렛에 남은 조: {names}',
      'sign.title': '출석 크레인', 'sign.done': '출석 완료', 'board.title': '출석',
      'who.nobody': '출석자 없음', 'who.rollcall': '확인 중: {name}', 'who.inmachine': '기계 안',
      's.ready': '준비', 's.ball': '공이 도는 중', 's.slow': '너무 약함', 's.orderset': '순서 확정', 's.raceready': '경주 준비', 's.raceon': '경주 중',
      's.countdown': '카운트다운', 's.choosing': '고르는 중', 's.nograb': '놓침', 's.slipped': '미끄러짐', 's.coin': '코인 투입', 's.chute': '뽑혔다',
      's.picked': '뽑혔다', 's.present': '출석', 's.absent': '결석', 's.nobody': '출석자 없음', 's.undone': '되돌림', 's.done': '완료',
      's.allpicked': '모두 뽑힘', 's.nonames': '이름 없음', 's.editing': '편집 중', 's.lights': '불 켜는 중', 's.shuffling': '섞는 중',
      's.need2': '조가 2개 필요', 's.clip': '복사 차단됨', 's.onboard': '이미 있음', 's.wait': '잠시만', 's.power': '전원 켜짐',
      's.spinfor': '{ord} 돌리기', 's.place': '{ord} · {name}', 's.rostersaved': '명단 저장됨',
      'stamp.present': '출석', 'stamp.absent': '결석',
      'n.names': '{n}명', 'n.name': '{n}명', 'n.groups': '{n}개 조', 'n.group': '{n}개 조', 'n.left': '{n}명 남음',
      'n.groupsleft': '{n}개 조 남음', 'n.groupleft': '{n}개 조 남음', 'n.leftof': '{total}명 중 {left}명 남음', 'n.cans': '{names} · 캔 {cans}개',
      'pick.n': '{n}번째', 'next': '다음 · {name}', 'last.group': '마지막 조', 'all.picked': '모두 뽑힘',
      's.pressstart': '시작 버튼 또는 스페이스', 'btn.results': '결과 보기', 'kbd.space': 'Space',
      'ord': ['1번째', '2번째', '3번째', '4번째', '5번째', '6번째', '7번째', '8번째'],
      'keys.space': '돌리기 · 시작 · 불 켜기 · 다음', 'keys.p': '출석', 'keys.a': '결석', 'keys.z': '되돌리기', 'keys.s': '보드 섞기',
      'keys.f': '전체 화면', 'keys.m': '소리', 'keys.speed': '느리게 · 빠르게', 'keys.r': '명단',
      'copy.crane': '출석 크레인', 'copy.board': '출석 보드', 'copy.nobody': '출석자 없음', 'copy.absent': '결석',
      'race.leads': '{name} 선두', 'race.wins': '{name} 우승', 'race.photo': '사진 판정 · {name}',
      'r.title': '명단', 'r.fewer': '조 줄이기', 'r.more': '조 늘리기', 'r.shuffle': '이름을 조에 섞어 넣기', 'r.paste': '목록 붙여넣기',
      'r.replace': '명단 바꾸기', 'r.addto': '명단에 추가', 'r.restore': '기본 명단으로', 'r.restore2': '한 번 더 누르면 바뀝니다',
      'r.cancel': '취소', 'r.save': '저장', 'r.saveover': '저장하고 새로 시작', 'r.loses': '뽑은 결과 {n}개가 지워집니다', 'r.addname': '이름 추가',
      'r.need2': '순서를 정하려면 조가 2개 이상 필요합니다.', 'r.unsaved': '저장하지 않은 변경이 있습니다. 저장하거나 취소를 누르세요.',
      'r.dupes': '모두 이미 있는 이름입니다.', 'r.nonames': '붙여넣은 글에서 이름을 찾지 못했습니다.', 'r.here': '{p}명 출석', 'r.absentn': '{n}명 결석',
      'r.ungrouped': '조 없음',
    },
  };
  let lang = 'en';
  try { lang = localStorage.getItem(KEY) === 'ko' ? 'ko' : 'en'; } catch (e) {}
  const listeners = [];
  function t(key, vars) {
    const v = (D[lang] && D[lang][key] !== undefined ? D[lang][key] : D.en[key]);
    if (v === undefined) return key;
    if (typeof v !== 'string') return v;
    return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : v;
  }
  // counts: English needs singular/plural, Korean does not
  const count = (n, one, many) => t(n === 1 ? one : many, { n });
  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.dataset.i18nPh)); });
    root.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    document.documentElement.lang = lang;
    document.body && document.body.classList.toggle('ko', lang === 'ko');
    // Korean faces load only when Korean is chosen
    if (lang === 'ko' && !document.getElementById('koFonts')) {
      const l = document.createElement('link'); l.id = 'koFonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&display=swap';
      document.head.append(l);
    }
  }
  function set(l) {
    lang = l === 'ko' ? 'ko' : 'en';
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(); listeners.forEach(f => f(lang));
  }
  return { t, count, apply, set, onChange: f => listeners.push(f), get lang() { return lang; } };
})();
