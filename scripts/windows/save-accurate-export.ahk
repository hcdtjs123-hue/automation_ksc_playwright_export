#Requires AutoHotkey v2.0

; Wait for Save dialog.
WinWaitActive("Save As", , 10)

if !WinActive("Save As") {
    ; Fallback for other titles.
    WinWaitActive("Save", , 5)
}

; Small delay to ensure UI is ready.
Sleep 500

; Press Save (default button).
Send("{Enter}")

; Handle overwrite confirmation if needed.
Sleep 500
if WinActive("Confirm Save As") {
    Send("{Enter}")
}
