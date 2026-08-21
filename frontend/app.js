import * as THREE
    from "https://esm.sh/three@0.185.1";


import {
    liquidMetalFragmentShader,
    ShaderMount,
}
    from "https://esm.sh/@paper-design/shaders@0.0.80";


// ============================================================
// DOM
// ============================================================

const homeView =
    document.querySelector(
        "#homeView"
    );


const songsSetupView =
    document.querySelector(
        "#songsSetupView"
    );


const songsGameView =
    document.querySelector(
        "#songsGameView"
    );


const yearView =
    document.querySelector(
        "#yearView"
    );


const homeButtonShell =
    document.querySelector(
        "#homeButtonShell"
    );


const homeButton =
    document.querySelector(
        "#homeButton"
    );


const openSongsGame =
    document.querySelector(
        "#openSongsGame"
    );


const openYearGame =
    document.querySelector(
        "#openYearGame"
    );


const loginButtonShell =
    document.querySelector(
        "#loginButtonShell"
    );


const loginButton =
    document.querySelector(
        "#loginButton"
    );


const connectionStatus =
    document.querySelector(
        "#connectionStatus"
    );


// ============================================================
// SPOTIFY
// ============================================================

let player = null;

let deviceId = null;

let currentView =
    "home";


// ============================================================
// API
// ============================================================

async function api(
    path,
    options = {}
) {

    const response = await fetch(
        `/api${path}`,
        {
            ...options,

            headers: {
                "Content-Type":
                    "application/json",

                ...(options.headers || {}),
            },
        }
    );


    if (!response.ok) {

        let message =
            `${response.status} `
            + `${response.statusText}`;


        try {

            const payload =
                await response.json();


            message =
                payload.detail
                || message;

        } catch (_) {
            // Generic HTTP error.
        }


        throw new Error(
            message
        );
    }


    return response.json();
}


// ============================================================
// GLOBAL GLITTER
// ============================================================

const glitterVertexShader = `
    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = vec4(
            position.xy,
            0.0,
            1.0
        );
    }
`;


const glitterFragmentShader = `
    uniform float iTime;
    uniform float uIntensity;
    uniform sampler2D iChannel0;

    varying vec2 vUv;


    void main() {

        vec2 uv = vUv;

        float result = 0.0;


        result += texture2D(
            iChannel0,
            uv * 1.1
            + vec2(
                iTime * -0.005
            )
        ).r;


        result *= texture2D(
            iChannel0,
            uv * 0.9
            + vec2(
                iTime * 0.005
            )
        ).g;


        result = pow(
            result,
            12.0
        );


        gl_FragColor = vec4(
            vec3(uIntensity)
            * result,
            1.0
        );
    }
`;


function generateNoiseTexture(
    size = 512
) {

    const data =
        new Uint8Array(
            size
            * size
            * 4
        );


    for (
        let i = 0;
        i < size * size;
        i++
    ) {

        const stride =
            i * 4;


        data[stride] =
            Math.random()
            * 255;

        data[stride + 1] =
            Math.random()
            * 255;

        data[stride + 2] =
            Math.random()
            * 255;

        data[stride + 3] =
            255;
    }


    const texture =
        new THREE.DataTexture(
            data,
            size,
            size,
            THREE.RGBAFormat
        );


    texture.wrapS =
        THREE.RepeatWrapping;

    texture.wrapT =
        THREE.RepeatWrapping;

    texture.minFilter =
        THREE.LinearFilter;

    texture.magFilter =
        THREE.LinearFilter;

    texture.needsUpdate =
        true;


    return texture;
}


class GlitterBackground {

    constructor(
        container,
        {
            speed = 0.75,
            intensity = 5.0,
        } = {}
    ) {

        this.container =
            container;


        this.speed =
            speed;


        this.clock =
            new THREE.Clock();


        this.renderer =
            new THREE.WebGLRenderer({

                antialias:
                    false,

                powerPreference:
                    "high-performance",
            });


        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );


        container.appendChild(
            this.renderer.domElement
        );


        this.scene =
            new THREE.Scene();


        this.camera =
            new THREE.Camera();


        const noiseTexture =
            generateNoiseTexture(
                512
            );


        this.material =
            new THREE.ShaderMaterial({

                uniforms: {

                    iTime: {
                        value: 0,
                    },

                    uIntensity: {
                        value:
                            intensity,
                    },

                    iChannel0: {
                        value:
                            noiseTexture,
                    },
                },

                vertexShader:
                    glitterVertexShader,

                fragmentShader:
                    glitterFragmentShader,
            });


        this.plane =
            new THREE.Mesh(

                new THREE.PlaneGeometry(
                    2,
                    2
                ),

                this.material
            );


        this.scene.add(
            this.plane
        );


        this.resize =
            this.resize.bind(
                this
            );


        this.animate =
            this.animate.bind(
                this
            );


        window.addEventListener(
            "resize",
            this.resize
        );


        this.resize();

        this.animate();
    }


    resize() {

        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight,
            false
        );
    }


    animate() {

        this.material
            .uniforms
            .iTime
            .value =
                this.clock
                    .getElapsedTime()
                * this.speed;


        this.renderer.render(
            this.scene,
            this.camera
        );


        requestAnimationFrame(
            this.animate
        );
    }
}


new GlitterBackground(
    document.querySelector(
        "#globalGlitterBackground"
    ),
    {
        speed:
            0.75,

        intensity:
            5.0,
    }
);


// ============================================================
// LIQUID METAL
// ============================================================

const initialisedLiquidButtons =
    new WeakSet();


function createRipple(
    shell,
    event
) {

    const rect =
        shell.getBoundingClientRect();


    const ripple =
        document.createElement(
            "span"
        );


    ripple.className =
        "liquid-metal-ripple";


    ripple.style.left =
        `${
            event.clientX
            - rect.left
        }px`;


    ripple.style.top =
        `${
            event.clientY
            - rect.top
        }px`;


    shell.appendChild(
        ripple
    );


    window.setTimeout(
        () => {
            ripple.remove();
        },
        600
    );
}


function initialiseLiquidMetalButton(
    shell
) {

    if (
        initialisedLiquidButtons.has(
            shell
        )
    ) {
        return;
    }


    const shaderContainer =
        shell.querySelector(
            ".liquid-metal-shader"
        );


    const button =
        shell.querySelector(
            ".liquid-metal-control"
        );


    if (
        !shaderContainer
        || !button
    ) {
        return;
    }


    const shaderMount =
        new ShaderMount(

            shaderContainer,

            liquidMetalFragmentShader,

            {
                u_repetition:
                    4,

                u_softness:
                    0.5,

                u_shiftRed:
                    0.3,

                u_shiftBlue:
                    0.3,

                u_distortion:
                    0,

                u_contour:
                    0,

                u_angle:
                    45,

                u_scale:
                    8,

                u_shape:
                    1,

                u_offsetX:
                    0.1,

                u_offsetY:
                    -0.1,
            },

            undefined,

            0.6
        );


    initialisedLiquidButtons.add(
        shell
    );


    const updateDisabledState =
        () => {

            shell.classList.toggle(
                "is-disabled",
                button.disabled
            );
        };


    updateDisabledState();


    const observer =
        new MutationObserver(
            updateDisabledState
        );


    observer.observe(
        button,
        {
            attributes:
                true,

            attributeFilter: [
                "disabled",
            ],
        }
    );


    shell.addEventListener(
        "mouseenter",
        () => {

            if (button.disabled) {
                return;
            }


            shell.classList.add(
                "is-hovered"
            );


            shaderMount
                .setSpeed?.(
                    1
                );
        }
    );


    shell.addEventListener(
        "mouseleave",
        () => {

            shell.classList.remove(
                "is-hovered",
                "is-pressed"
            );


            shaderMount
                .setSpeed?.(
                    0.6
                );
        }
    );


    button.addEventListener(
        "pointerdown",
        event => {

            if (button.disabled) {
                return;
            }


            shell.classList.add(
                "is-pressed"
            );


            shaderMount
                .setSpeed?.(
                    2.4
                );


            createRipple(
                shell,
                event
            );
        }
    );


    button.addEventListener(
        "pointerup",
        () => {

            shell.classList.remove(
                "is-pressed"
            );


            shaderMount
                .setSpeed?.(
                    1
                );
        }
    );


    button.addEventListener(
        "pointercancel",
        () => {

            shell.classList.remove(
                "is-pressed"
            );
        }
    );


    button.addEventListener(
        "click",
        () => {

            window.setTimeout(
                () => {

                    const hovered =
                        shell
                            .classList
                            .contains(
                                "is-hovered"
                            );


                    shaderMount
                        .setSpeed?.(
                            hovered
                                ? 1
                                : 0.6
                        );

                },
                300
            );
        }
    );
}


function initialiseVisibleLiquidButtons() {

    window.requestAnimationFrame(
        () => {

            document
                .querySelectorAll(
                    "[data-liquid-metal]"
                )
                .forEach(
                    shell => {

                        if (
                            shell.hidden
                            ||
                            shell.offsetParent
                            === null
                        ) {
                            return;
                        }


                        initialiseLiquidMetalButton(
                            shell
                        );
                    }
                );
        }
    );
}


// ============================================================
// SONGS DOM
// ============================================================

const songsPlaylistForm =
    document.querySelector(
        "#songsPlaylistForm"
    );


const songsPlaylistInput =
    document.querySelector(
        "#songsPlaylistInput"
    );


const songsSetupStatus =
    document.querySelector(
        "#songsSetupStatus"
    );


const songsPlayButton =
    document.querySelector(
        "#songsPlayButton"
    );


const songsSkipButton =
    document.querySelector(
        "#songsSkipButton"
    );


const songsRevealButton =
    document.querySelector(
        "#songsRevealButton"
    );


const songsNewPlaylistButton =
    document.querySelector(
        "#songsNewPlaylistButton"
    );


const songsReveal =
    document.querySelector(
        "#songsReveal"
    );


const songsRevealCover =
    document.querySelector(
        "#songsRevealCover"
    );


const songsRevealTitle =
    document.querySelector(
        "#songsRevealTitle"
    );


const songsRevealArtist =
    document.querySelector(
        "#songsRevealArtist"
    );


const songsRevealYear =
    document.querySelector(
        "#songsRevealYear"
    );


const songsStatus =
    document.querySelector(
        "#songsStatus"
    );


const songsCounter =
    document.querySelector(
        "#songsCounter"
    );


// ============================================================
// SONGS STATE
// ============================================================

const songsGame = {

    sessionId:
        null,

    trackCount:
        0,

    playedCount:
        0,

    isPlaying:
        false,

    finished:
        false,

    remainingMs:
        30_000,

    startedAt:
        null,

    timer:
        null,
};


// ============================================================
// SONGS HELPERS
// ============================================================

function setSongsStatus(
    text
) {

    songsStatus.textContent =
        text;
}


function updateSongsCounter() {

    if (!songsGame.trackCount) {

        songsCounter.textContent =
            "";

        return;
    }


    songsCounter.textContent =
        `Song `
        + `${songsGame.playedCount}`
        + ` von `
        + `${songsGame.trackCount}`;
}


function clearSongsTimer() {

    if (
        songsGame.timer
        !== null
    ) {

        clearTimeout(
            songsGame.timer
        );


        songsGame.timer =
            null;
    }
}


function pauseSongsTimer() {

    if (
        songsGame.isPlaying
        &&
        songsGame.startedAt
    ) {

        const elapsed =
            Date.now()
            - songsGame.startedAt;


        songsGame.remainingMs =
            Math.max(
                0,
                songsGame.remainingMs
                - elapsed
            );
    }


    clearSongsTimer();


    songsGame.isPlaying =
        false;
}


function hideSongReveal() {

    songsReveal.hidden =
        true;


    songsRevealCover.removeAttribute(
        "src"
    );


    songsRevealTitle.textContent =
        "";


    songsRevealArtist.textContent =
        "";


    songsRevealYear.textContent =
        "";
}


function prepareSongsRound() {

    clearSongsTimer();


    songsGame.remainingMs =
        30_000;


    songsGame.finished =
        false;


    hideSongReveal();


    songsPlayButton.disabled =
        false;


    songsPlayButton.textContent =
        "Pause";


    songsSkipButton.disabled =
        false;


    songsRevealButton.disabled =
        false;
}


function armSongsTimer() {

    clearSongsTimer();


    songsGame.startedAt =
        Date.now();


    songsGame.timer =
        setTimeout(
            async () => {

                try {

                    await player.pause();

                } finally {

                    songsGame.isPlaying =
                        false;


                    songsGame.remainingMs =
                        0;


                    songsPlayButton.disabled =
                        true;


                    songsPlayButton.textContent =
                        "30 Sekunden vorbei";


                    songsSkipButton.disabled =
                        false;


                    songsRevealButton.disabled =
                        false;


                    setSongsStatus(
                        "30 Sekunden vorbei."
                    );
                }

            },

            songsGame.remainingMs
        );
}


async function playSongsCurrentTrack() {

    await api(
        "/player/play",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    session_id:
                        songsGame.sessionId,

                    device_id:
                        deviceId,
                }),
        }
    );


    songsGame.isPlaying =
        true;


    songsGame.remainingMs =
        30_000;


    songsPlayButton.disabled =
        false;


    songsPlayButton.textContent =
        "Pause";


    setSongsStatus(
        "Song läuft..."
    );


    armSongsTimer();
}


// ============================================================
// START SONG GAME
// ============================================================

async function startSongsGame() {

    const playlistUrl =
        songsPlaylistInput
            .value
            .trim();


    if (!playlistUrl) {

        songsSetupStatus.textContent =
            "Bitte zuerst eine Playlist einfügen.";

        return;
    }


    if (!deviceId) {

        songsSetupStatus.textContent =
            "Spotify Player ist noch nicht bereit.";

        return;
    }


    songsSetupStatus.textContent =
        "Playlist wird geladen...";


    await player.activateElement();


    if (songsGame.sessionId) {

        try {

            await api(
                `/game/${songsGame.sessionId}`,
                {
                    method:
                        "DELETE",
                }
            );

        } catch (_) {
            // Continue.
        }
    }


    const game =
        await api(
            "/game/songs/start",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        playlist_url:
                            playlistUrl,
                    }),
            }
        );


    songsGame.sessionId =
        game.session_id;


    songsGame.trackCount =
        game.track_count;


    songsGame.playedCount =
        game.played_count;


    prepareSongsRound();


    updateSongsCounter();


    songsSetupStatus.textContent =
        "";


    await showView(
        "songsGame"
    );


    await playSongsCurrentTrack();
}


// ============================================================
// PLAY / PAUSE
// ============================================================

async function toggleSongsPlayback() {

    if (!songsGame.sessionId) {
        return;
    }


    if (songsGame.finished) {
        return;
    }


    if (songsGame.isPlaying) {

        pauseSongsTimer();


        await player.pause();


        songsPlayButton.textContent =
            "Weiter";


        setSongsStatus(
            "Pausiert."
        );


        return;
    }


    if (
        songsGame.remainingMs
        <= 0
    ) {
        return;
    }


    await player.resume();


    songsGame.isPlaying =
        true;


    songsPlayButton.textContent =
        "Pause";


    setSongsStatus(
        "Song läuft..."
    );


    armSongsTimer();
}


// ============================================================
// SKIP
// ============================================================

async function skipSongsTrack() {

    if (!songsGame.sessionId) {
        return;
    }


    pauseSongsTimer();


    try {

        await player.pause();

    } catch (_) {
        // Nothing playing.
    }


    const result =
        await api(
            `/game/${songsGame.sessionId}/next`,
            {
                method:
                    "POST",
            }
        );


    if (result.finished) {

        songsGame.finished =
            true;


        songsPlayButton.disabled =
            true;


        songsSkipButton.disabled =
            true;


        songsRevealButton.disabled =
            true;


        setSongsStatus(
            "Alle Songs dieser Playlist wurden gespielt."
        );


        return;
    }


    songsGame.playedCount =
        result.played_count;


    prepareSongsRound();


    updateSongsCounter();


    await playSongsCurrentTrack();
}


// ============================================================
// REVEAL
// ============================================================

async function revealSongsTrack() {

    if (!songsGame.sessionId) {
        return;
    }


    const result =
        await api(
            `/game/${songsGame.sessionId}/reveal`
        );


    songsRevealTitle.textContent =
        result.name;


    songsRevealArtist.textContent =
        result.artists.join(
            ", "
        );


    songsRevealYear.textContent =
        result.release_year
            ? `Release · ${result.release_year}`
            : "Release year unknown";


    if (result.cover_url) {

        songsRevealCover.src =
            result.cover_url;


        songsRevealCover.hidden =
            false;

    } else {

        songsRevealCover.hidden =
            true;
    }


    songsReveal.hidden =
        false;
}


// ============================================================
// RESET SONGS
// ============================================================

async function resetSongsGame(
    targetView = "songsSetup"
) {

    pauseSongsTimer();


    if (player) {

        try {

            await player.pause();

        } catch (_) {
            // Nothing playing.
        }
    }


    if (songsGame.sessionId) {

        try {

            await api(
                `/game/${songsGame.sessionId}`,
                {
                    method:
                        "DELETE",
                }
            );

        } catch (error) {

            console.error(
                error
            );
        }
    }


    songsGame.sessionId =
        null;


    songsGame.trackCount =
        0;


    songsGame.playedCount =
        0;


    songsGame.finished =
        false;


    songsGame.remainingMs =
        30_000;


    songsPlaylistInput.value =
        "";


    songsPlayButton.textContent =
        "Pause";


    songsPlayButton.disabled =
        false;


    songsSkipButton.disabled =
        true;


    songsRevealButton.disabled =
        true;


    songsCounter.textContent =
        "";


    songsStatus.textContent =
        "";


    songsSetupStatus.textContent =
        "";


    hideSongReveal();


    await showView(
        targetView
    );


    if (
        targetView ===
        "songsSetup"
    ) {

        songsPlaylistInput.focus();
    }
}


// ============================================================
// SONG EVENTS
// ============================================================

songsPlaylistForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        try {

            await startSongsGame();

        } catch (error) {

            console.error(
                error
            );


            songsSetupStatus.textContent =
                error.message;
        }
    }
);


songsPlayButton.addEventListener(
    "click",
    async () => {

        try {

            await toggleSongsPlayback();

        } catch (error) {

            console.error(
                error
            );


            setSongsStatus(
                error.message
            );
        }
    }
);


songsSkipButton.addEventListener(
    "click",
    async () => {

        try {

            await skipSongsTrack();

        } catch (error) {

            console.error(
                error
            );


            setSongsStatus(
                error.message
            );
        }
    }
);


songsRevealButton.addEventListener(
    "click",
    async () => {

        try {

            await revealSongsTrack();

        } catch (error) {

            console.error(
                error
            );


            setSongsStatus(
                error.message
            );
        }
    }
);


songsNewPlaylistButton.addEventListener(
    "click",
    async () => {

        await resetSongsGame(
            "songsSetup"
        );
    }
);


// ============================================================
// YEAR DOM
// ============================================================

const yearPlaylistInput =
    document.querySelector(
        "#yearPlaylistInput"
    );


const yearPlayButton =
    document.querySelector(
        "#yearPlayButton"
    );


const yearNextButton =
    document.querySelector(
        "#yearNextButton"
    );


const yearResetButton =
    document.querySelector(
        "#yearResetButton"
    );


const yearCountdown =
    document.querySelector(
        "#yearCountdown"
    );


const yearChoices =
    document.querySelector(
        "#yearChoices"
    );


const yearResult =
    document.querySelector(
        "#yearResult"
    );


const yearStatus =
    document.querySelector(
        "#yearStatus"
    );


const yearCounter =
    document.querySelector(
        "#yearCounter"
    );


// ============================================================
// YEAR STATE
// ============================================================

const yearGame = {

    sessionId:
        null,

    trackCount:
        0,

    playedCount:
        0,

    phase:
        "idle",

    isPlaying:
        false,

    listeningRemainingMs:
        30_000,

    listeningStartedAt:
        null,

    listeningTimer:
        null,

    countdownTimer:
        null,

    countdownRemaining:
        10,
};


// ============================================================
// YEAR HELPERS
// ============================================================

function setYearStatus(
    text
) {

    yearStatus.textContent =
        text;
}


function updateYearCounter() {

    if (!yearGame.trackCount) {

        yearCounter.textContent =
            "";

        return;
    }


    yearCounter.textContent =
        `Song `
        + `${yearGame.playedCount}`
        + ` von `
        + `${yearGame.trackCount}`;
}


function clearYearListeningTimer() {

    if (
        yearGame.listeningTimer
        !== null
    ) {

        clearTimeout(
            yearGame.listeningTimer
        );


        yearGame.listeningTimer =
            null;
    }
}


function pauseYearListeningTimer() {

    if (
        yearGame.phase
        === "listening"
        &&
        yearGame.isPlaying
        &&
        yearGame.listeningStartedAt
    ) {

        const elapsed =
            Date.now()
            - yearGame.listeningStartedAt;


        yearGame.listeningRemainingMs =
            Math.max(
                0,
                yearGame.listeningRemainingMs
                - elapsed
            );
    }


    clearYearListeningTimer();


    yearGame.isPlaying =
        false;
}


function clearYearCountdown() {

    if (
        yearGame.countdownTimer
        !== null
    ) {

        clearInterval(
            yearGame.countdownTimer
        );


        yearGame.countdownTimer =
            null;
    }
}


function setYearButtonsEnabled(
    enabled
) {

    yearChoices
        .querySelectorAll(
            "button"
        )
        .forEach(
            button => {

                button.disabled =
                    !enabled;
            }
        );
}


function renderYearChoices(
    choices
) {

    yearChoices.innerHTML =
        "";


    for (
        const year of choices
    ) {

        const button =
            document.createElement(
                "button"
            );


        button.className =
            "year-choice";


        button.textContent =
            year;


        button.disabled =
            true;


        button.addEventListener(
            "click",
            async () => {

                try {

                    await submitYearAnswer(
                        year
                    );

                } catch (error) {

                    setYearStatus(
                        error.message
                    );
                }
            }
        );


        yearChoices.appendChild(
            button
        );
    }
}


// ============================================================
// YEAR TIMER
// ============================================================

function armYearListeningTimer() {

    clearYearListeningTimer();


    yearGame.listeningStartedAt =
        Date.now();


    yearGame.listeningTimer =
        setTimeout(
            async () => {

                await finishYearListening();

            },

            yearGame.listeningRemainingMs
        );
}


async function finishYearListening() {

    clearYearListeningTimer();


    await player.pause();


    yearGame.isPlaying =
        false;


    yearGame.phase =
        "countdown";


    yearPlayButton.disabled =
        true;


    yearPlayButton.textContent =
        "10 Sekunden gehört";


    setYearStatus(
        "Jetzt wählen!"
    );


    startYearCountdown();
}


function startYearCountdown() {

    clearYearCountdown();


    yearGame.countdownRemaining =
        10;


    yearCountdown.textContent =
        yearGame.countdownRemaining;


    setYearButtonsEnabled(
        true
    );


    yearGame.countdownTimer =
        setInterval(
            async () => {

                yearGame.countdownRemaining -=
                    1;


                yearCountdown.textContent =
                    yearGame.countdownRemaining;


                if (
                    yearGame.countdownRemaining
                    <= 0
                ) {

                    clearYearCountdown();


                    yearCountdown.textContent =
                        "0";


                    await submitYearAnswer(
                        null
                    );
                }

            },

            1000
        );
}


// ============================================================
// YEAR PLAY
// ============================================================

async function playCurrentYearTrack() {

    await api(
        "/player/play",
        {
            method:
                "POST",

            body:
                JSON.stringify({
                    session_id:
                        yearGame.sessionId,

                    device_id:
                        deviceId,
                }),
        }
    );


    yearGame.phase =
        "listening";


    yearGame.isPlaying =
        true;


    yearGame.listeningRemainingMs =
        30_000;


    yearPlayButton.disabled =
        false;


    yearPlayButton.textContent =
        "Pause";


    setYearStatus(
        "10 Sekunden zuhören..."
    );


    armYearListeningTimer();
}


function prepareYearRound(
    result
) {

    clearYearListeningTimer();

    clearYearCountdown();


    yearGame.playedCount =
        result.played_count;


    yearGame.phase =
        "listening";


    yearGame.isPlaying =
        false;


    yearGame.listeningRemainingMs =
        30_000;


    yearCountdown.textContent =
        "–";


    yearResult.hidden =
        true;


    yearResult.textContent =
        "";


    renderYearChoices(
        result.choices
    );


    yearNextButton.disabled =
        false;


    yearResetButton.disabled =
        false;


    updateYearCounter();
}


// ============================================================
// YEAR START
// ============================================================

async function startYearGame() {

    const playlistUrl =
        yearPlaylistInput
            .value
            .trim();


    if (!playlistUrl) {

        setYearStatus(
            "Bitte zuerst eine Playlist einfügen."
        );

        return;
    }


    if (!deviceId) {

        setYearStatus(
            "Spotify Player ist noch nicht bereit."
        );

        return;
    }


    await player.activateElement();


    const game =
        await api(
            "/game/year/start",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        playlist_url:
                            playlistUrl,
                    }),
            }
        );


    yearGame.sessionId =
        game.session_id;


    yearGame.trackCount =
        game.track_count;


    console.log(
        "Playlist year standard deviation:",
        game.playlist_year_std
    );


    yearPlaylistInput.disabled =
        true;


    prepareYearRound(
        game
    );


    await playCurrentYearTrack();
}


// ============================================================
// YEAR PAUSE
// ============================================================

async function toggleYearPlayback() {

    if (!yearGame.sessionId) {

        await startYearGame();

        return;
    }


    if (
        yearGame.phase
        !== "listening"
    ) {
        return;
    }


    if (yearGame.isPlaying) {

        pauseYearListeningTimer();


        await player.pause();


        yearPlayButton.textContent =
            "Weiter";


        setYearStatus(
            "Pausiert."
        );


        return;
    }


    await player.resume();


    yearGame.isPlaying =
        true;


    yearPlayButton.textContent =
        "Pause";


    setYearStatus(
        "Weiter zuhören..."
    );


    armYearListeningTimer();
}


// ============================================================
// YEAR ANSWER
// ============================================================

async function submitYearAnswer(
    selectedYear
) {

    if (
        yearGame.phase
        !== "countdown"
    ) {
        return;
    }


    clearYearCountdown();


    setYearButtonsEnabled(
        false
    );


    const result =
        await api(
            `/game/${yearGame.sessionId}/answer`,
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        selected_year:
                            selectedYear,
                    }),
            }
        );


    yearGame.phase =
        "answered";


    const artists =
        result.artists.join(
            ", "
        );


    yearResult.hidden =
        false;


    if (result.timed_out) {

        yearResult.textContent =
            `Zeit vorbei · `
            + `${result.name} · `
            + `${artists} · `
            + `${result.correct_year}`;

    } else if (result.correct) {

        yearResult.textContent =
            `Richtig · `
            + `${result.name} · `
            + `${result.correct_year}`;

    } else {

        yearResult.textContent =
            `Falsch · `
            + `${result.name} · `
            + `${artists} · `
            + `${result.correct_year}`;
    }
}


// ============================================================
// YEAR NEXT
// ============================================================

async function nextYearTrack() {

    if (!yearGame.sessionId) {
        return;
    }


    pauseYearListeningTimer();

    clearYearCountdown();


    try {

        await player.pause();

    } catch (_) {
        // Nothing playing.
    }


    const result =
        await api(
            `/game/${yearGame.sessionId}/next`,
            {
                method:
                    "POST",
            }
        );


    if (result.finished) {

        yearGame.phase =
            "finished";


        yearPlayButton.disabled =
            true;


        yearNextButton.disabled =
            true;


        setYearButtonsEnabled(
            false
        );


        setYearStatus(
            "Alle Songs wurden gespielt."
        );


        return;
    }


    prepareYearRound(
        result
    );


    await playCurrentYearTrack();
}


// ============================================================
// YEAR RESET
// ============================================================

async function resetYearGame(
    targetView = "year"
) {

    pauseYearListeningTimer();

    clearYearCountdown();


    if (player) {

        try {

            await player.pause();

        } catch (_) {
            // Nothing playing.
        }
    }


    if (yearGame.sessionId) {

        try {

            await api(
                `/game/${yearGame.sessionId}`,
                {
                    method:
                        "DELETE",
                }
            );

        } catch (_) {
            // Ignore.
        }
    }


    yearGame.sessionId =
        null;


    yearGame.trackCount =
        0;


    yearGame.playedCount =
        0;


    yearGame.phase =
        "idle";


    yearPlaylistInput.disabled =
        false;


    yearPlaylistInput.value =
        "";


    yearPlayButton.disabled =
        false;


    yearPlayButton.textContent =
        "Start";


    yearNextButton.disabled =
        true;


    yearResetButton.disabled =
        true;


    yearChoices.innerHTML =
        "";


    yearResult.hidden =
        true;


    yearCountdown.textContent =
        "–";


    yearCounter.textContent =
        "";


    setYearStatus(
        "Playlist einfügen und Start drücken."
    );


    await showView(
        targetView
    );
}


// ============================================================
// YEAR EVENTS
// ============================================================

yearPlayButton.addEventListener(
    "click",
    async () => {

        try {

            await toggleYearPlayback();

        } catch (error) {

            setYearStatus(
                error.message
            );
        }
    }
);


yearNextButton.addEventListener(
    "click",
    async () => {

        try {

            await nextYearTrack();

        } catch (error) {

            setYearStatus(
                error.message
            );
        }
    }
);


yearResetButton.addEventListener(
    "click",
    async () => {

        await resetYearGame(
            "year"
        );
    }
);


// ============================================================
// NAVIGATION
// ============================================================

async function showView(
    viewName
) {

    homeView.hidden =
        viewName !==
        "home";


    songsSetupView.hidden =
        viewName !==
        "songsSetup";


    songsGameView.hidden =
        viewName !==
        "songsGame";


    yearView.hidden =
        viewName !==
        "year";


    homeButtonShell.hidden =
        viewName ===
        "home";


    currentView =
        viewName;


    initialiseVisibleLiquidButtons();
}


homeButton.addEventListener(
    "click",
    async () => {

        if (
            currentView ===
            "songsGame"
        ) {

            await resetSongsGame(
                "home"
            );

            return;
        }


        if (
            currentView ===
            "year"
            &&
            yearGame.sessionId
        ) {

            await resetYearGame(
                "home"
            );

            return;
        }


        await showView(
            "home"
        );
    }
);


openSongsGame.addEventListener(
    "click",
    async () => {

        await showView(
            "songsSetup"
        );


        songsPlaylistInput.focus();
    }
);


openYearGame.addEventListener(
    "click",
    async () => {

        await showView(
            "year"
        );
    }
);


// ============================================================
// AUTH
// ============================================================

loginButton.addEventListener(
    "click",
    () => {

        window.location.href =
            "/api/auth/login";
    }
);


async function checkAuthentication() {

    try {

        const result =
            await api(
                "/auth/status"
            );


        if (
            result.authenticated
        ) {

            connectionStatus.textContent =
                "Spotify verbunden";


            loginButtonShell.hidden =
                true;


            return true;
        }


        connectionStatus.textContent =
            "Spotify verbinden, um zu starten";


        loginButtonShell.hidden =
            false;


        initialiseVisibleLiquidButtons();


        return false;

    } catch (error) {

        connectionStatus.textContent =
            "Backend nicht erreichbar";


        console.error(
            error
        );


        return false;
    }
}


// ============================================================
// SPOTIFY WEB PLAYBACK SDK
// ============================================================

window.onSpotifyWebPlaybackSDKReady =
    () => {

        player =
            new Spotify.Player({

                name:
                    "Spotify Quiz",

                getOAuthToken:
                    async callback => {

                        try {

                            const token =
                                await api(
                                    "/auth/token"
                                );


                            callback(
                                token.access_token
                            );

                        } catch (error) {

                            console.error(
                                error
                            );
                        }
                    },

                volume:
                    0.5,
            });


        player.addListener(
            "ready",
            ({ device_id }) => {

                deviceId =
                    device_id;


                connectionStatus.textContent =
                    "Spotify bereit";
            }
        );


        player.addListener(
            "not_ready",
            () => {

                deviceId =
                    null;


                connectionStatus.textContent =
                    "Spotify Player offline";
            }
        );


        player.addListener(
            "initialization_error",
            ({ message }) => {

                console.error(
                    message
                );
            }
        );


        player.addListener(
            "authentication_error",
            ({ message }) => {

                console.error(
                    message
                );
            }
        );


        player.addListener(
            "account_error",
            ({ message }) => {

                console.error(
                    message
                );
            }
        );


        player.addListener(
            "playback_error",
            ({ message }) => {

                console.error(
                    message
                );
            }
        );


        player.connect();
    };


function loadSpotifySdk() {

    if (
        document.querySelector(
            "script[data-spotify-sdk]"
        )
    ) {
        return;
    }


    const script =
        document.createElement(
            "script"
        );


    script.src =
        "https://sdk.scdn.co/spotify-player.js";


    script.dataset.spotifySdk =
        "true";


    document.body.appendChild(
        script
    );
}


// ============================================================
// START
// ============================================================

await showView(
    "home"
);


const authenticated =
    await checkAuthentication();


if (authenticated) {

    connectionStatus.textContent =
        "Spotify Player wird geladen...";


    loadSpotifySdk();
}