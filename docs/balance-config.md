# 전투 밸런스 설정 관리

수치의 원본은 저장소 루트 `balance-config.js`다. 현재 값은 기준 커밋 `94e6b329d3aa4e82b04174c4f993a7c531c6fd20`의 수치를 유지한다. 테스트 전용이며 운영 DB·BASIC CHECK·학생 계정과 연결하지 않는다.

## 수정 및 반영

저장소 루트에서 다음 명령을 실행한다. 별도 패키지 설치 없이 Node.js만 사용한다.

```sh
node scripts/build-balance.cjs
node scripts/build-balance.cjs --check
node tests/balance-config.cjs
```

1. `balance-config.js`의 수치를 변경한다.
2. 빌드 명령을 실행하면 기존 `v0.2.html`의 BALANCE_CONFIG 마커 안만 갱신한다. 다른 HTML·로직·에셋은 그대로 보존한다.
3. 설정 파일과 생성된 HTML을 함께 커밋한다. `--check`는 빌드 누락을 오류로 보고한다. 같은 입력의 재빌드는 파일을 변경하지 않는다.
4. 커밋 고정 플레이 주소는 기존처럼 해당 커밋의 `v0.2.html`을 사용한다. 실행 시 `balance-config.js`를 별도로 요청하지 않는다. 이미지와 설정이 모두 내장되어 파일 다운로드·단일 HTML·RawGitHack 테스트 방식이 유지된다.

HTML 안의 생성된 설정 복사본은 직접 수정하지 않는다. 숫자 원본은 JS 파일 한 곳이며, 생성 블록에는 원본 SHA-256을 기록한다. 빌드는 기본적인 범위/유한값/패턴 순서/단계 보호 조건을 검증한 뒤 출력한다. 알 수 없는 새 무기를 설정만으로 추가할 수는 없다.

## 변경할 위치

아래 경로는 모두 `balance-config.js` 내부다. 길이는 월드 픽셀, 시간은 초, 각도는 도 단위다. 공격 빈도는 초당 횟수가 아니라 쿨다운/예고/회복 시간으로 지정한다.

| 조정 항목 | 설정 경로 | 현재 값 / 의미 |
|---|---|---|
| 플레이어 최대 HP | `player.maxHp` | 100, 초기화·지역 이동·회복 상한·HP UI에 반영 |
| 이동속도·몸 반경 | `player.moveSpeed`, `player.radius` | 178, 17 |
| 기본 공격력 | `player.baseStats.attack` | 1 |
| 레벨업 회복량 | `player.levelUpHeal` | 20 |
| 플레이어 검 거리·각도 | `weapons.sword.range`, `arcDegrees` | 70, 90도; 판정과 이펙트 함께 반영 |
| 검 공격 간격·애니메이션·클릭 버퍼 | `weapons.sword.cooldown`, `duration`, `buffer` | 0.39, 0.24, 0.13 |
| 넉백·피격 표현 시간 | `weapons.sword.knockback`, `knockDuration`, `hitFlash` | 16, 0.10, 0.19 |
| 슬라임 HP·피해·속도 | `monsters.slime.hp`, `damage`, `speed` | 3, 9, 42 |
| 슬라임 감지·정지·접촉 거리 | `monsters.slime.aggroRange`, `stopDistance`, `contactRange` | 350, 35, 38 |
| 슬라임 피격 후 무적 | `monsters.slime.damageInvulnerability` | 0.95 |
| 몬스터 크기·지형 충돌 반경 | `monsters.<id>.radius`, `collisionRadius` | 19, 16 |
| 자동인형 HP·이동 | `monsters.automaton.hp`, `speed` | 12, 124.6 |
| 자동인형 각 무장의 거리·폭·피해·리듬 | `automaton.patterns[0..3]` | 순서: 검·창·활·지팡이. `range`, `width`, `damage`, `windup`, `recovery` |
| 자동인형 검 각도 | `automaton.patterns[0].arcDegrees` | 90도 |
| 원거리 거리 유지 | `automaton.patterns[2..3].minDistance`, `maxDistance` | 활 170~270, 지팡이 145~230 |
| 시작·전환 대기 / 접근·측면 이동 비율 | `automaton.initialDelay`, `transitionDelay`, `approachRatio`, `strafeRatio` | 0.4, 0.25, 0.85, 0.45 |
| 자동인형 피격 후 무적·이펙트 수명·단계 보호 | `automaton.damageInvulnerability`, `effectDuration`, `protectedHp` | 0.7, 0.22, 1 |
| 화살 속도·수명 | `automaton.projectile.speed`, `lifetime` | 310, 2 |
| 훈련검 공격력 보너스 | `equipment.trainingSword.bonuses.attack` | +1; 설명과 미리보기에도 반영 |
| 시작 레벨·레벨업 필요 경험치 | `progression.initialLevel`, `xpBase`, `xpPerLevel` | 1, 30, 레벨당 +15 |
| 슬라임 퀘스트 처치 수 | `quests.slimeTraining.requiredKills` | 3; 진행 UI·지급 조건에 함께 반영 |
| 처치·퀘스트 보상 | `rewards.monsters`, `rewards.quests` | XP, 재화, 재료, 장비 수량. 기존 중복 지급 방지 유지 |
| 숲 재생성 목표 수·시간·안전 거리 | `spawning` | 기존 초기 배치 2기 유지. 목표 수는 재생성에 사용 |
| 최소 공격 피해·프레임 최대 간격 | `combat.minimumAttackDamage`, `maxFrameDt` | 1, 0.04 |

자동인형의 무장별 피해는 `automaton.patterns[].damage`가 원본이다. 몬스터 목록의 레거시 피해 정보는 첫 패턴 값에서 파생되며 별도 중복 조절 항목을 두지 않는다.

자동인형 단계별 HP 경계는 전체 HP를 네 단계로 나눠 계산한다. HP만 조정해도 마지막 단계에서 처치할 수 있으며, 모든 패턴 실제 실행을 기다리는 보호 규칙을 유지한다. 정수 HP 구간을 원하면 HP를 4의 배수로 설정한다.

## 설정과 계산의 경계

- 설정은 순수 데이터이며 런타임에서 깊게 동결된다. 캐릭터 HP·보유량·착용 슬롯 등 가변 상태는 별도다.
- `v0.2.html`의 `calculateStats`는 기본 능력치와 착용 슬롯 보너스를 합산한다. 반복 착용으로 누적 변경하지 않는다.
- `calculateAttackDamage`, `inStrike`, `automatonStrikeHits`, `hitByAutomaton`, AI 업데이트 함수가 실제 계산과 상태 변경을 담당한다. 각도→코사인/라디안 변환도 로직에서 처리한다.
- 장비 이름·슬롯 정의·그래픽·무장별 회피 안내는 표현/게임 로직에 남겨 수치 설정과 구분한다.
- 기본 능력치·장비 보너스는 스탯 맵이라 키를 확장할 수 있다. 방어력·치명타·스킬 피해를 실제 전투에 적용하려면 해당 계산 규칙과 테스트를 별도 구현해야 한다. 이번 변경은 그 기능을 추가하지 않는다.

## 검증

`tests/balance-config.cjs`는 원본 커밋과 현재 기본값을 비교하고, 메모리에서만 수치를 바꾼 설정을 빌드해 실제 브라우저에서 HP·이동·피해·장비·AI·퀘스트·보상이 반영되는지 검증한다. 디스크의 기본 수치는 바꾸지 않는다. 오프라인 HTML 실행, 외부 요청 없음, 빌드 일관성 및 기본 오류 검증도 포함한다.

기존 테스트 실행:

```sh
for suite in eight-direction-attack rewards-inventory equipment mobile-joystick play-mode attack-input regions-evaluation training-automaton duel-tuning; do
  node "tests/$suite.cjs" || exit 1
done
```

실제 모바일 조작감과 iOS Safari 엔진 검증은 별도다. 숫자 변경 후에는 관련 테스트의 기대값도 새 의도에 맞게 검토하되, 실패를 숨기기 위해 검증을 삭제하지 않는다.
