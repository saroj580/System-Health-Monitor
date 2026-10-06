Unicode true

!define APP_NAME "System Monitor and Task Automator"
!define APP_VER "1.0.0-PreAlpha"
!define APP_VER_NUM "1.0.0.0"
!define App_Publisher "System Monitor Team"
!define App_Exe "System Monitor.exe"
!define Description "System Monitor and Task Automator is a desktop application that provides real-time system monitoring and task automation"
!define LegalTradeMarks ""
!define SOURCE_DIR "dist-app"
!define APP_WEBSITE "https://github.com/saroj580/System-Health-Monitor"
!define APP_License_File "LICENSE"
!define OUT_FILE "dist-installer"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

; General Settings
Name "${APP_NAME} v${APP_VER}"
OutFile "${OUT_FILE}\${APP_NAME}_${APP_VER}_Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_NAME}" "InstallLocation"
RequestExecutionLevel user

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!include "FileFunc.nsh"

VIProductVersion "${APP_VER_NUM}"
VIAddVersionKey /LANG=1033 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${APP_VER}"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VER_NUM}"
VIAddVersionKey /LANG=1033 "CompanyName" "${App_Publisher}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright (c) 2026 ${App_Publisher}"
VIAddVersionKey /LANG=1033 "LegalTrademarks" "${LegalTradeMarks}"
VIAddVersionKey /LANG=1033 "FileDescription" "${Description}"

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${APP_License_File}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Finish page must configure RUN options before inserting macro
!define MUI_FINISHPAGE_RUN "$INSTDIR\${App_Exe}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Main Section" SecMain
    DetailPrint "Stopping existing application instances..."
    nsExec::Exec 'powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -Command "Stop-Process -Name \"System Monitor\", \"backend\", \"electron\" -Force -ErrorAction SilentlyContinue"'

    SetOutPath $INSTDIR
    File /r "${SOURCE_DIR}\*.*"
    WriteUninstaller "$INSTDIR\uninstall.exe"

    DetailPrint "Configuring Windows Defender Firewall..."
    nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "$INSTDIR\scripts\FirewallRule.ps1" -Action Add -Port 8003'
SectionEnd

Section "Shortcuts" SecShortcuts
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${App_Exe}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${App_Exe}"
SectionEnd

; Registry entry for Add/Remove Programs
Section "Add to Add/Remove Programs" SecReg
    WriteRegStr HKCU "Software\${APP_NAME}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VER}"
    WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${App_Publisher}"
    WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${App_Exe}"
    WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${APP_WEBSITE}"
    WriteRegStr HKCU "${UNINST_KEY}" "HelpLink" "${APP_WEBSITE}"
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall" SecUninst
    DetailPrint "Stopping running application instances..."
    nsExec::Exec 'powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -Command "Stop-Process -Name \"System Monitor\", \"backend\", \"electron\" -Force -ErrorAction SilentlyContinue"'

    DetailPrint "Removing Firewall rules..."
    ${If} ${FileExists} "$INSTDIR\scripts\FirewallRule.ps1"
        nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "$INSTDIR\scripts\FirewallRule.ps1" -Action Remove -Port 8003'
    ${EndIf}

    ; Delete shortcuts
    Delete "$DESKTOP\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"

    ; Remove installation files and directory
    RMDir /r "$INSTDIR"

    ; Clean registry
    DeleteRegKey HKCU "${UNINST_KEY}"
    DeleteRegKey HKCU "Software\${APP_NAME}"
SectionEnd
