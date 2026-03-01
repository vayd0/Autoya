Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

Dim projectDir
projectDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

objShell.Run "cmd /c chcp 65001 >nul && node """ & projectDir & "\src\setup.js""", 0, False