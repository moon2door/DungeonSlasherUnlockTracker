# 던전슬래셔 해금 현황

Steam판 던전슬래셔의 로컬 세이브를 읽어 스킬·유물 해금 현황을 보여주는 Windows용 조회 도구입니다.


## 사용법

`DungeonSlasherDashboard.exe`를 열면 기본 브라우저에 해금 현황이 표시됩니다. 게임에서 진행도가 저장된 뒤 앱의 **새로고침** 버튼으로 반영할 수 있습니다.

배포용 EXE에 .NET 런타임과 도감·아이콘이 포함되어 있습니다.

스킬과 유물 목록에서 **해금 루트**를 열면 현재 세이브에 맞는 해금 조건과 추천 조합을 볼 수 있습니다. 별 버튼으로 항목을 저장하고 **즐겨찾기만**으로 모아 볼 수 있습니다.

앱은 현재 Windows 사용자의 `DGSave.es3`를 읽기 전용으로 엽니다. 
암호화된 세이브는 설치본의 저장 설정을 읽어 로컬에서 복호화합니다. 
브라우저와 앱은 같은 PC의 `127.0.0.1`에서 통신합니다.

## 소스 구성

- `ProgressReader.cs`와 `GameSettings.cs`에서 게임 세이브와 저장 설정을 읽습니다.
- `web/recommendations.js`와 `web/loadouts.js`에서 해금 순서와 유물 조합을 정합니다.
- `web/unlock-routes.js`와 `web/unlock-loadouts.js`에서 항목별 해금 루트와 추천 조합을 만듭니다.
- `FavoritesStore.cs`에서 즐겨찾기를 로컬에 저장합니다.
- `tools/build_catalog.py`에서 도감과 아이콘을 생성합니다.

## 소스에서 빌드

Windows 64비트에서 Steam판 던전슬래셔, .NET 10 SDK, Python 3.12를 준비합니다. PowerShell에서 프로젝트 폴더를 열고 세 번째 명령의 경로를 게임 설치 경로로 바꿔 실행합니다.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\tools\requirements.txt
.\.venv\Scripts\python.exe -X utf8 .\tools\build_catalog.py 'C:\Program Files (x86)\Steam\steamapps\common\DUNGEON SLASHER'
dotnet publish .\DungeonSlasherDashboard.csproj -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:EnableCompressionInSingleFile=true -p:DebugType=None -p:DebugSymbols=false -o .\dist
```

빌드가 끝나면 `dist\DungeonSlasherDashboard.exe`를 실행할 수 있습니다. 생성한 도감·아이콘과 빌드 결과는 `.gitignore`에 등록되어 있습니다.
