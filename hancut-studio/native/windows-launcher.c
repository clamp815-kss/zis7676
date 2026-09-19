typedef unsigned short WCHAR;
typedef unsigned long DWORD;
typedef int BOOL;
typedef unsigned short WORD;
typedef unsigned char BYTE;
typedef void *HANDLE;
typedef void *HMODULE;
typedef void *HWND;
typedef WCHAR *LPWSTR;
typedef const WCHAR *LPCWSTR;
typedef void *LPVOID;

typedef struct {
    DWORD cb;
    LPWSTR lpReserved;
    LPWSTR lpDesktop;
    LPWSTR lpTitle;
    DWORD dwX;
    DWORD dwY;
    DWORD dwXSize;
    DWORD dwYSize;
    DWORD dwXCountChars;
    DWORD dwYCountChars;
    DWORD dwFillAttribute;
    DWORD dwFlags;
    WORD wShowWindow;
    WORD cbReserved2;
    BYTE *lpReserved2;
    HANDLE hStdInput;
    HANDLE hStdOutput;
    HANDLE hStdError;
} STARTUPINFOW;

typedef struct {
    HANDLE hProcess;
    HANDLE hThread;
    DWORD dwProcessId;
    DWORD dwThreadId;
} PROCESS_INFORMATION;

__declspec(dllimport) DWORD GetModuleFileNameW(HMODULE module, LPWSTR filename, DWORD size);
__declspec(dllimport) DWORD GetFileAttributesW(LPCWSTR filename);
__declspec(dllimport) BOOL CreateProcessW(LPCWSTR applicationName, LPWSTR commandLine,
        LPVOID processAttributes, LPVOID threadAttributes, BOOL inheritHandles,
        DWORD creationFlags, LPVOID environment, LPCWSTR currentDirectory,
        STARTUPINFOW *startupInfo, PROCESS_INFORMATION *processInformation);
__declspec(dllimport) BOOL CloseHandle(HANDLE handle);
__declspec(dllimport) void ExitProcess(unsigned int exitCode);
__declspec(dllimport) int MessageBoxW(HWND window, LPCWSTR text, LPCWSTR caption, unsigned int type);

#define INVALID_FILE_ATTRIBUTES ((DWORD)-1)
#define MAX_PATH_BUFFER 4096

static WCHAR modulePath[MAX_PATH_BUFFER];
static WCHAR directoryPath[MAX_PATH_BUFFER];
static WCHAR javaPath[MAX_PATH_BUFFER];
static WCHAR jarPath[MAX_PATH_BUFFER];
static WCHAR commandLine[MAX_PATH_BUFFER * 3];
static STARTUPINFOW startupInfo;
static PROCESS_INFORMATION processInfo;

static unsigned int lengthOf(const WCHAR *text) {
    unsigned int length = 0;
    while (text[length]) length++;
    return length;
}

static BOOL append(WCHAR *target, unsigned int capacity, const WCHAR *value) {
    unsigned int offset = lengthOf(target);
    unsigned int index = 0;
    while (value[index]) {
        if (offset + index + 1 >= capacity) return 0;
        target[offset + index] = value[index];
        index++;
    }
    target[offset + index] = 0;
    return 1;
}

static BOOL copy(WCHAR *target, unsigned int capacity, const WCHAR *value) {
    target[0] = 0;
    return append(target, capacity, value);
}

void WinMainCRTStartup(void) {
    static const WCHAR runtimeSuffix[] = L"\\runtime\\bin\\javaw.exe";
    static const WCHAR jarSuffix[] = L"\\hancut-studio-0.1.0.jar";
    static const WCHAR systemJava[] = L"javaw.exe";
    static const WCHAR quote[] = L"\"";
    static const WCHAR jarArgument[] = L"\" -jar \"";
    static const WCHAR errorTitle[] = L"HanCut Studio";
    static const WCHAR errorMessage[] =
        L"HanCut Studio를 시작하지 못했습니다.\n\n"
        L"Microsoft OpenJDK 21 이상을 설치한 뒤 다시 실행하세요.\n"
        L"명령: winget install Microsoft.OpenJDK.21";

    DWORD count = GetModuleFileNameW((HMODULE)0, modulePath, MAX_PATH_BUFFER);
    if (count == 0 || count >= MAX_PATH_BUFFER) {
        MessageBoxW((HWND)0, errorMessage, errorTitle, 0x10);
        ExitProcess(2);
    }

    copy(directoryPath, MAX_PATH_BUFFER, modulePath);
    int index = (int)lengthOf(directoryPath) - 1;
    while (index >= 0 && directoryPath[index] != L'\\' && directoryPath[index] != L'/') index--;
    if (index < 0) {
        copy(directoryPath, MAX_PATH_BUFFER, L".");
    } else {
        directoryPath[index] = 0;
    }

    copy(javaPath, MAX_PATH_BUFFER, directoryPath);
    append(javaPath, MAX_PATH_BUFFER, runtimeSuffix);
    if (GetFileAttributesW(javaPath) == INVALID_FILE_ATTRIBUTES) {
        copy(javaPath, MAX_PATH_BUFFER, systemJava);
    }

    copy(jarPath, MAX_PATH_BUFFER, directoryPath);
    append(jarPath, MAX_PATH_BUFFER, jarSuffix);

    copy(commandLine, MAX_PATH_BUFFER * 3, quote);
    if (!append(commandLine, MAX_PATH_BUFFER * 3, javaPath)
            || !append(commandLine, MAX_PATH_BUFFER * 3, jarArgument)
            || !append(commandLine, MAX_PATH_BUFFER * 3, jarPath)
            || !append(commandLine, MAX_PATH_BUFFER * 3, quote)) {
        MessageBoxW((HWND)0, errorMessage, errorTitle, 0x10);
        ExitProcess(3);
    }

    startupInfo.cb = sizeof(STARTUPINFOW);
    BOOL started = CreateProcessW((LPCWSTR)0, commandLine, (LPVOID)0, (LPVOID)0, 0,
            0, (LPVOID)0, directoryPath, &startupInfo, &processInfo);
    if (!started) {
        MessageBoxW((HWND)0, errorMessage, errorTitle, 0x10);
        ExitProcess(1);
    }

    CloseHandle(processInfo.hThread);
    CloseHandle(processInfo.hProcess);
    ExitProcess(0);
}
