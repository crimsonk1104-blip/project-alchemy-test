# project-alchemy-test
PROJECT ALCHEMY RPG Test

플레이 파일은 `v0.2.html`이며 이미지·설정이 내장된 단일 HTML이다.
밸런스 원본은 `balance-config.js`에서 관리한다. 수치 변경 후:

```sh
node scripts/build-balance.cjs
node scripts/build-balance.cjs --check
node tests/balance-config.cjs
```

설정과 생성된 `v0.2.html`을 함께 커밋한다. 게임 로직을 수정할 때는 HTML의 생성된 설정 블록 밖을 편집한다.
[설정 항목·반영 방법·회귀 테스트 안내](docs/balance-config.md)

모든 캐릭터·보상·장비는 새로고침/재시작 시 초기화되는 테스트 데이터다.
