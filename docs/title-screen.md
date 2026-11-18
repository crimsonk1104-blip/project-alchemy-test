# Title screen prototype

Branch feat/title-screen is based on feat/chapter01-playable. Normal URLs show the title before any gameplay, with PROJECT ALCHEMY / CHAPTER 01 / prototype, New Game, unavailable Continue, Settings, and credits/test information.

New Game resets the temporary character and opens CH01 in the viewport play layout. Combat sandbox controls are hidden for this path. The toolbar's Title button clears input and pauses the session; starting again creates a fresh character. There is no save/resume promise or browser storage. Refresh always returns to the title.

Settings actually control title background motion, larger dialogue text and an optional fullscreen request on New Game. Unsupported/denied fullscreen uses the existing viewport fallback. No BGM or sound implementation is claimed. Settings last only for the current page; OS reduced-motion preference is respected.

The existing combat sandbox is retained inside the collapsed Development Test Entry details in credits/test information. Explicit `?test=1` starts that legacy entry for automation. Normal play never auto-enters it. Existing regression fixtures now opt into that URL, preserving their assertions; CH01 tests click New Game, and the offline single-HTML test also starts from the title. No dialogue, balance source, AI or equipment rules were changed.

Build: existing `node scripts/build-story.cjs` and `node scripts/build-balance.cjs` continue to work; both support --check. The title shell is inline HTML/CSS/JS and requires no new assets or external requests.

Verification: `node tests/title-screen.cjs` covers PC1280×800, phone844×390 and360×640, tablet1180×820 and820×1180; visible menu bounds, no horizontal overflow, blocked gameplay before start, settings, disabled Continue, new CH01, title return/reset/reload, unsupported fullscreen and hidden test entry. `tests/chapter01-story.cjs` still covers all four starter choices and the full evaluation/report/cabinet flow from New Game. Physical device feel and iOS Safari require separate testing.

Validation result: 15 scripts passed in Chromium (new title suite plus all 14 existing suites). Legacy forest fixtures were updated to use the new bootstrap with explicit forest selection; existing combat/reward assertions were not removed. Story tests now start through New Game and assert viewport mode. Offline HTML is also started through New Game. Both bundle checks and inline script syntax checks pass. WebKit was unavailable; physical iOS/Android validation remains separate.
