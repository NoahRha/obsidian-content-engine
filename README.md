# Obsidian Content Engine

AI로 옵시디언 위키를 분석하여 블로그, 유튜브, 소셜 미디어 콘텐츠를 자동 생성·배포합니다.

## 설치 방법

### BART를 통한 설치 (권장)

1. Obsidian에서 **BART** 플러그인을 설치합니다 (설정 → 커뮤니티 플러그인 → BART)
2. `Cmd+Shift+P` → **BART: Install plugin** 선택
3. 다음 URL을 입력합니다:
   ```
   https://github.com/NoahRha/obsidian-content-engine
   ```
4. 설치 후 **Content Engine** 플러그인을 활성화합니다

### 수동 설치

1. [릴리즈](https://github.com/NoahRha/obsidian-content-engine/releases)에서 최신 버전 다운로드
2. Obsidian의 `.obsidian/plugins/obsidian-content-engine/` 폴더에 압축 해제
3. Obsidian 설정 → 커뮤니티 플러그인 → Content Engine 활성화

## 사용 방법

1. **설정**: 우측 상단 로켓 아이콘 클릭 → Content Engine → API URL 및 플랫폼 설정
2. **노트 분석**: Ribbon 로켓 아이콘 클릭 또는 `Cmd+Shift+P` → `Content Engine: Analyze & Publish`
3. **노트 선택**: 분석할 노트들을 체크박스로 선택
4. **분석 시작**: "분석 시작" 버튼 클릭
5. **콘텐츠 생성**: 각 탭(블로그/유튜브/Thread/인스타그램/페이스북)에서 "재생성" 버튼으로 콘텐츠 생성
6. **발행**: "발행" 버튼으로 각 플랫폼에 발행

## 기능

- 🤖 **AI 분석**: 옵시디언 위키에서 새로운 인사이트 자동 발견
- 📝 **블로그 발행**: WordPress API로 블로그 포스트 자동 작성·발행
- 🎬 **유튜브 영상**: Remotion으로 하이라이트 영상 자동 생성
- 📱 **소셜 미디어**: Thread, Instagram, Facebook 동시 발행
- 🔧 **하네스 엔지니어링**: 각 작업별 전용 서브에이전트 배치
- 🎨 **미리보기**: 블로그 포스트 실시간 미리보기

## 설정

- **API URL**: 콘텐츠 엔진 API 서버 주소
- **Vault Path**: 옵시디언 vault 경로 (자동 감지됨)
- **플랫폼 토글**: 사용할 플랫폼 선택

## 개발

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 개발 모드
npm run dev
```

## 라이선스

MIT

---

저자: Noah Rha
