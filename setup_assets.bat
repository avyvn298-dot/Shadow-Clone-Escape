@echo off
echo Setting up game asset folders...

REM Create folders
mkdir assets\characters
mkdir assets\powerups
mkdir assets\obstacles
mkdir assets\background
mkdir assets\audio

REM Move & rename characters
move "%USERPROFILE%\Downloads\*ninja*.png" assets\characters\ninja_spritesheet.png
move "%USERPROFILE%\Downloads\*clone*.png" assets\characters\clones_spritesheet.png
move "%USERPROFILE%\Downloads\*portal*.png" assets\characters\portal_spritesheet.png

REM Move & rename powerups
move "%USERPROFILE%\Downloads\*speed*.png" assets\powerups\powerup_speed.png
move "%USERPROFILE%\Downloads\*cloak*.png" assets\powerups\powerup_cloak.png
move "%USERPROFILE%\Downloads\*powerup*.png" assets\powerups\powerup_clone.png

REM Move obstacles
move "%USERPROFILE%\Downloads\*obstacle*.png" assets\obstacles\obstacles_spritesheet.png

REM Move backgrounds
move "%USERPROFILE%\Downloads\*bg1*.png" assets\background\bg_layer1.png
move "%USERPROFILE%\Downloads\*bg2*.png" assets\background\bg_layer2.png
move "%USERPROFILE%\Downloads\*bg3*.png" assets\background\bg_layer3.png
move "%USERPROFILE%\Downloads\*bg4*.png" assets\background\bg_layer4.png

REM Move audio
move "%USERPROFILE%\Downloads\*music*.mp3" assets\audio\bg_music_loop.mp3
move "%USERPROFILE%\Downloads\*jump*.wav" assets\audio\sfx_jump.wav
move "%USERPROFILE%\Downloads\*clone*.wav" assets\audio\sfx_clone.wav
move "%USERPROFILE%\Downloads\*powerup*.wav" assets\audio\sfx_powerup.wav
move "%USERPROFILE%\Downloads\*portal*.wav" assets\audio\sfx_portal.wav

echo Done! All files moved into /assets.
pause
