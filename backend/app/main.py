from __future__ import annotations

import os
import random
import re
import secrets
import statistics

from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import uuid4

import spotipy

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from spotipy.cache_handler import CacheFileHandler
from spotipy.oauth2 import SpotifyOAuth


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="Spotify Quiz Backend",
    root_path="/api",
)


# ============================================================
# SPOTIFY AUTHENTICATION
# ============================================================

SCOPES = " ".join(
    [
        "playlist-read-private",
        "playlist-read-collaborative",
        "streaming",
        "user-read-private",
        "user-read-email",
        "user-read-playback-state",
        "user-modify-playback-state",
    ]
)


cache_handler = CacheFileHandler(
    cache_path="/app/.cache/spotify-token"
)


oauth = SpotifyOAuth(
    client_id=os.environ["SPOTIPY_CLIENT_ID"],
    client_secret=os.environ["SPOTIPY_CLIENT_SECRET"],
    redirect_uri=os.environ["SPOTIPY_REDIRECT_URI"],
    scope=SCOPES,
    cache_handler=cache_handler,
    open_browser=False,
    show_dialog=True,
)


pending_oauth_states: set[str] = set()


# ============================================================
# GAME STATE
# ============================================================

@dataclass
class GameSession:
    mode: str

    tracks: list[dict[str, Any]]

    remaining_indexes: list[int]

    used_indexes: list[int] = field(
        default_factory=list
    )

    current_index: int | None = None

    year_std: float = 0.0

    current_year_options: list[int] = field(
        default_factory=list
    )

    round_answered: bool = False


sessions: dict[str, GameSession] = {}


# ============================================================
# REQUEST MODELS
# ============================================================

class StartGameRequest(BaseModel):
    playlist_url: str


class PlayRequest(BaseModel):
    session_id: str
    device_id: str


class YearAnswerRequest(BaseModel):
    selected_year: int | None = None


# ============================================================
# SPOTIFY HELPERS
# ============================================================

def get_token_info() -> dict[str, Any]:

    token_info = oauth.validate_token(
        cache_handler.get_cached_token()
    )

    if token_info is None:

        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Spotify",
        )

    return token_info


def spotify_client() -> spotipy.Spotify:

    token_info = get_token_info()

    return spotipy.Spotify(
        auth=token_info["access_token"]
    )


def playlist_id_from_input(
    value: str,
) -> str:

    value = value.strip()

    if value.startswith(
        "spotify:playlist:"
    ):
        return value.split(":")[-1]

    match = re.search(
        r"open\.spotify\.com/playlist/([A-Za-z0-9]+)",
        value,
    )

    if match:
        return match.group(1)

    if re.fullmatch(
        r"[A-Za-z0-9]+",
        value,
    ):
        return value

    raise HTTPException(
        status_code=400,
        detail=(
            "That does not look like a "
            "Spotify playlist URL or ID."
        ),
    )


def release_year_from_track(
    track: dict[str, Any],
) -> int | None:

    album = track.get("album") or {}

    release_date = album.get(
        "release_date"
    )

    if not release_date:
        return None

    try:
        return int(
            release_date[:4]
        )

    except (ValueError, TypeError):
        return None


def cover_url_from_track(
    track: dict[str, Any],
) -> str | None:

    album = track.get("album") or {}

    images = album.get(
        "images",
        [],
    )

    if not images:
        return None

    # Spotify normally returns the largest
    # album image first.
    return images[0].get(
        "url"
    )


def load_playlist_tracks(
    sp: spotipy.Spotify,
    playlist_id: str,
) -> list[dict[str, Any]]:

    tracks: list[dict[str, Any]] = []

    offset = 0

    while True:

        page = sp.playlist_items(
            playlist_id,
            limit=50,
            offset=offset,
            additional_types=("track",),
        )

        entries = page.get(
            "items",
            [],
        )

        for entry in entries:

            track = (
                entry.get("item")
                or entry.get("track")
            )

            if not track:
                continue

            if track.get("type") != "track":
                continue

            if track.get("is_local"):
                continue

            if not track.get("uri"):
                continue

            tracks.append(
                {
                    "uri":
                        track["uri"],

                    "name":
                        track.get(
                            "name",
                            "Unknown song",
                        ),

                    "artists": [
                        artist["name"]
                        for artist
                        in track.get(
                            "artists",
                            [],
                        )
                    ],

                    "release_year":
                        release_year_from_track(
                            track
                        ),

                    "cover_url":
                        cover_url_from_track(
                            track
                        ),
                }
            )

        if not page.get("next"):
            break

        offset += len(
            entries
        )

    return tracks


def safe_load_playlist_tracks(
    sp: spotipy.Spotify,
    playlist_id: str,
) -> list[dict[str, Any]]:

    try:

        return load_playlist_tracks(
            sp,
            playlist_id,
        )

    except spotipy.SpotifyException as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "Spotify rejected the playlist "
                f"request: {exc}"
            ),
        ) from exc


# ============================================================
# RANDOM TRACK LOGIC
# ============================================================

def draw_track(
    session: GameSession,
) -> bool:

    if not session.remaining_indexes:

        session.current_index = None

        return False

    index = random.choice(
        session.remaining_indexes
    )

    session.remaining_indexes.remove(
        index
    )

    session.used_indexes.append(
        index
    )

    session.current_index = index

    session.round_answered = False

    if session.mode == "year":

        track = session.tracks[
            index
        ]

        correct_year = track[
            "release_year"
        ]

        session.current_year_options = (
            make_year_options(
                correct_year,
                session.year_std,
            )
        )

    return True


def current_track(
    session: GameSession,
) -> dict[str, Any]:

    if session.current_index is None:

        raise HTTPException(
            status_code=409,
            detail="There is no current song.",
        )

    return session.tracks[
        session.current_index
    ]


# ============================================================
# YEAR ANSWERS
# ============================================================

def make_year_options(
    correct_year: int,
    playlist_std: float,
) -> list[int]:

    sigma = max(
        playlist_std,
        2.0,
    )

    current_year = (
        date.today().year
    )

    options: set[int] = {
        correct_year
    }

    attempts = 0

    while (
        len(options) < 4
        and attempts < 500
    ):

        candidate = round(
            random.gauss(
                correct_year,
                sigma,
            )
        )

        attempts += 1

        if candidate == correct_year:
            continue

        if candidate < 1900:
            continue

        if candidate > current_year:
            continue

        options.add(
            candidate
        )

    fallback_offset = 1

    while len(options) < 4:

        for candidate in (
            correct_year
            - fallback_offset,

            correct_year
            + fallback_offset,
        ):

            if (
                1900
                <= candidate
                <= current_year
            ):
                options.add(
                    candidate
                )

            if len(options) == 4:
                break

        fallback_offset += 1

    result = list(
        options
    )

    random.shuffle(
        result
    )

    return result


# ============================================================
# SHARED RESPONSE
# ============================================================

def round_response(
    session: GameSession,
) -> dict[str, Any]:

    response: dict[str, Any] = {
        "played_count":
            len(
                session.used_indexes
            ),

        "remaining_count":
            len(
                session.remaining_indexes
            ),
    }

    if session.mode == "year":

        response["choices"] = (
            session.current_year_options
        )

    return response


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health() -> dict[str, str]:

    return {
        "status": "ok",
        "service": "backend",
    }


# ============================================================
# AUTH
# ============================================================

@app.get("/auth/status")
def auth_status() -> dict[str, bool]:

    token_info = oauth.validate_token(
        cache_handler.get_cached_token()
    )

    return {
        "authenticated":
            token_info is not None
    }


@app.get("/auth/login")
def auth_login():

    state = secrets.token_urlsafe(
        24
    )

    pending_oauth_states.add(
        state
    )

    url = oauth.get_authorize_url(
        state=state
    )

    return RedirectResponse(
        url
    )


@app.get("/auth/callback")
def auth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):

    if error:

        raise HTTPException(
            status_code=400,
            detail=(
                "Spotify authorization failed: "
                f"{error}"
            ),
        )

    if (
        not code
        or not state
        or state not in pending_oauth_states
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid OAuth callback.",
        )

    pending_oauth_states.remove(
        state
    )

    oauth.get_access_token(
        code=code,
        check_cache=False,
    )

    return RedirectResponse(
        "/"
    )


@app.get("/auth/token")
def auth_token() -> dict[str, str]:

    token_info = get_token_info()

    return {
        "access_token":
            token_info["access_token"]
    }


# ============================================================
# SONGS RATEN
# ============================================================

@app.post("/game/songs/start")
def start_song_game(
    request: StartGameRequest,
) -> dict[str, Any]:

    sp = spotify_client()

    playlist_id = playlist_id_from_input(
        request.playlist_url
    )

    tracks = safe_load_playlist_tracks(
        sp,
        playlist_id,
    )

    if not tracks:

        raise HTTPException(
            status_code=400,
            detail=(
                "No usable tracks were found "
                "in this playlist."
            ),
        )

    session_id = str(
        uuid4()
    )

    session = GameSession(
        mode="songs",

        tracks=tracks,

        remaining_indexes=list(
            range(
                len(tracks)
            )
        ),
    )

    sessions[
        session_id
    ] = session

    draw_track(
        session
    )

    return {
        "session_id":
            session_id,

        "track_count":
            len(tracks),

        **round_response(
            session
        ),
    }


@app.get(
    "/game/{session_id}/reveal"
)
def reveal_song(
    session_id: str,
) -> dict[str, Any]:

    session = sessions.get(
        session_id
    )

    if session is None:

        raise HTTPException(
            status_code=404,
            detail="Game session not found.",
        )

    if session.mode != "songs":

        raise HTTPException(
            status_code=400,
            detail=(
                "Reveal is only available "
                "in Songs raten."
            ),
        )

    track = current_track(
        session
    )

    return {
        "name":
            track["name"],

        "artists":
            track["artists"],

        "release_year":
            track["release_year"],

        "cover_url":
            track["cover_url"],
    }


# ============================================================
# JAHR RATEN
# ============================================================

@app.post("/game/year/start")
def start_year_game(
    request: StartGameRequest,
) -> dict[str, Any]:

    sp = spotify_client()

    playlist_id = playlist_id_from_input(
        request.playlist_url
    )

    all_tracks = safe_load_playlist_tracks(
        sp,
        playlist_id,
    )

    tracks = [
        track
        for track in all_tracks
        if track["release_year"]
        is not None
    ]

    if len(tracks) < 4:

        raise HTTPException(
            status_code=400,
            detail=(
                "Jahr raten needs at least "
                "4 tracks with release years."
            ),
        )

    years = [
        track["release_year"]
        for track in tracks
    ]

    year_std = statistics.pstdev(
        years
    )

    session_id = str(
        uuid4()
    )

    session = GameSession(
        mode="year",

        tracks=tracks,

        remaining_indexes=list(
            range(
                len(tracks)
            )
        ),

        year_std=year_std,
    )

    sessions[
        session_id
    ] = session

    draw_track(
        session
    )

    return {
        "session_id":
            session_id,

        "track_count":
            len(tracks),

        "playlist_year_std":
            round(
                year_std,
                2,
            ),

        **round_response(
            session
        ),
    }


@app.post(
    "/game/{session_id}/answer"
)
def answer_year(
    session_id: str,
    request: YearAnswerRequest,
) -> dict[str, Any]:

    session = sessions.get(
        session_id
    )

    if session is None:

        raise HTTPException(
            status_code=404,
            detail="Game session not found.",
        )

    if session.mode != "year":

        raise HTTPException(
            status_code=400,
            detail=(
                "This game does not "
                "accept year answers."
            ),
        )

    if session.round_answered:

        raise HTTPException(
            status_code=409,
            detail=(
                "This round was already answered."
            ),
        )

    track = current_track(
        session
    )

    correct_year = track[
        "release_year"
    ]

    session.round_answered = True

    return {
        "correct":
            request.selected_year
            == correct_year,

        "timed_out":
            request.selected_year
            is None,

        "correct_year":
            correct_year,

        "name":
            track["name"],

        "artists":
            track["artists"],

        "cover_url":
            track["cover_url"],
    }


# ============================================================
# NEXT TRACK
# ============================================================

@app.post(
    "/game/{session_id}/next"
)
def next_track(
    session_id: str,
) -> dict[str, Any]:

    session = sessions.get(
        session_id
    )

    if session is None:

        raise HTTPException(
            status_code=404,
            detail="Game session not found.",
        )

    has_track = draw_track(
        session
    )

    if not has_track:

        return {
            "finished":
                True,

            "played_count":
                len(
                    session.used_indexes
                ),

            "remaining_count":
                0,
        }

    return {
        "finished":
            False,

        **round_response(
            session
        ),
    }


# ============================================================
# DELETE GAME
# ============================================================

@app.delete(
    "/game/{session_id}"
)
def delete_game(
    session_id: str,
) -> dict[str, bool]:

    sessions.pop(
        session_id,
        None,
    )

    return {
        "deleted":
            True
    }


# ============================================================
# PLAYBACK
# ============================================================

@app.post("/player/play")
def play_track(
    request: PlayRequest,
) -> dict[str, str]:

    session = sessions.get(
        request.session_id
    )

    if session is None:

        raise HTTPException(
            status_code=404,
            detail="Game session not found.",
        )

    track = current_track(
        session
    )

    sp = spotify_client()

    try:

        sp.start_playback(
            device_id=
                request.device_id,

            uris=[
                track["uri"]
            ],

            position_ms=0,
        )

    except spotipy.SpotifyException as exc:

        raise HTTPException(
            status_code=502,
            detail=(
                "Spotify could not start "
                f"playback: {exc}"
            ),
        ) from exc

    return {
        "status":
            "playing"
    }