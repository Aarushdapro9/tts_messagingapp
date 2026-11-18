# Single-player game validation

Validated on 18 November 2026 against the local browser build.

- Launchers tested: 574
- Launchers that rendered an interactive surface in the first pass: 546
- Slow launchers confirmed by the extended visual check: 11
- Removed as blank or blocked after the extended check: 5
- Games remaining after the validation run: 569

## Post-validation addition

- 10 Minutes Till Dawn was added afterward and passed a local browser runtime check. The current catalogue contains 570 games.

## Removed

- Blackjack (`clblackjackhhhh.html`)
- Minecraft Case Simulator (`clminecraftcasesim.html`)
- Moto X3M M (`clmotox3mm.html`)
- Omega Nugget Clicker (`clomeganuggetclicker.html`)
- Red vs Blue War (`clredvsbluewar.html`)

## Slow renderers retained

These pages did not respond to automated DOM or screenshot commands, which can happen while a Canvas, Unity, or Flash runtime owns the main thread. They did not report a load failure, so they were retained rather than removed as false positives.

- Angry Birds
- Sonic: Falling Star
- Cheese Rolling
- Doki Doki Literature Club
- Geometry Dash Wave
- Granny 3
- Mari0
- OneShot (old)
- Super Mario Bros. Remastered
- Cat Mario
- Tube Jumpers
- Undertale Yellow
