# CHAPTER 01 playable prototype

Base: feat/reagent-throw (407b50c). No main or existing PR merge. Test-only in-memory data; refresh/full restart clears identity, equipment and progress. Failure/region retry preserves them.

## Sources and build

`story-data.js`: only the dialogue performed in game, plus required choice replies. Scenes 1–2 and 5 retain review-draft labels; 3–4 use the November 9 approved revision; 6–final retain the November 8 approved spoken text. Private reference manuscript, planning metadata and source URL are not committed. Stage directions are represented by temporary room/NPC/cabinet presentation rather than finished cinematics.

`story-runtime.js`: scene/line cursor, required name/weapon/ready choices, skip barriers, report and cabinet events. `scripts/build-story.cjs` embeds both sources in v0.2.html. Run after source edits:

```
node scripts/build-balance.cjs
node scripts/build-story.cjs
node scripts/build-balance.cjs --check
node scripts/build-story.cjs --check
```

The final HTML needs no runtime source requests. Balance source and AI geometry/timing are unchanged. Previously requested automaton pattern labels are carried forward as UI strings without merging the labels branch.

## State and equipment

`state.story` is separate from `state.evaluation` and the slime quest. Dialogue skip stops at mandatory input. Previous dialogue does not cross committed input barriers. Phase transitions are performed once at scene boundaries. Training victory sets objectiveMet; returning sets awaitingReport; reporting to the director starts scene 6 and completing that scene marks evaluation complete. Cabinet opens after scene 7; final scene marks prologue complete and previews 이상한 측정값. That next mission is not playable yet.

Starter IDs starterSword/starterSpear/starterBow/starterStaff are separate owned equipment entries with zero stat bonus. First selection grants one and equips it. Before cabinet opening, exchange returns the previous starter and grants the replacement; after cabinet opening all four are owned once and may be equipped/exchanged in the lobby. Existing trainingSword remains the separate slime quest test reward, with its existing +1 sword-only bonus. Active combat style remains a single activeWeapon value. No enhancement logic is implemented: a future first-enhancement event must end free initial exchanges without restricting acquisition/equipping other types.

The initial lobby also exposes the existing combat sandbox for regression/testing. Once dialogue advances, those legacy shortcuts are hidden; story choices and reports use their own controls. Full restart resets both paths. The room is a scene-based UI, not a navigable map.

## Script review and unfinished presentation

- Approved fourth choice remains 지팡이 and its approved reply is verbatim. Actual combat remains the reagent-bottle prototype; UI explicitly identifies this discrepancy. Renaming the approved choice/reply to alchemy tools requires review. The line describing weak ordinary attacks also needs review against current temporary damage numbers; neither line nor balance was changed.
- Scenes 1–2 and 5 remain drafts. No combat-style questionnaire has been restored.
- NPC portraits, shelves/desk/sofa, cabinet highlight and doorway text are temporary UI. No finished sprite animation, walking transition, voice, next-mission facility or cause of inconsistent readings is invented.
- Physical mobile comfort and iOS Safari require device testing.

## Validation

`tests/chapter01-story.cjs` exercises all four choices in actual Chromium pages using touch/keyboard UI and controlled combat positioning/time. It covers skip barriers, empty-name rejection, owned starter equipment, defeat/retry identity preservation, actual attack damage through all four protected AI stages, objectiveMet → awaitingReport → director report → completion, exact acceptance dialogue, cabinet opening and repeated exchange without duplication. Approved dialogue sections are also pinned by checksums verified against the supplied reference. Existing native keyboard/multitouch weapon and UI suites remain in place. Balance baseline assertions preserve all old numeric/gear comparisons while explicitly accounting for additive zero-bonus starter catalog entries and requested pattern label changes.

Validation result: all 14 scripts passed in Chromium (13 existing regression scripts plus the new CH01 script). Story paths cover PC1280×800, phone360×640 and844×390, tablet820×1180, including viewport fullscreen layout. Existing suites cover native keyboard/touch weapon attacks, scroll/rotation, AI dodge/phase gates, slime/evaluation quest separation, rewards/inventory/equipment and reset. WebKit/iOS Safari was not run because its browser binary is unavailable. Both bundle checks and inline script syntax checks pass. No manuscript copy is tracked.

## Scene 5 choice C update

Choice C now uses the newly requested director reply, then reopens the existing starter selection UI. Choosing a replacement equips it through the same exchange operation and returns to scene 5's ready choices, without revisiting name entry or earlier dialogue. Both Next and Skip on the C reply enter selection, not combat. Final preparation requires the explicit 실전 평가 시작 button; skip cannot start the fight. Approved scene 6–final dialogue remains checksum-protected and unchanged. The CH01 browser regression now tests two repeated C exchanges on each of four weapon paths, identity/equipment ownership preservation, no enemies before confirmation, and the explicit start gate.
