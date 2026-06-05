import base64
import argparse
import os
import re
from pathlib import Path
from openai import OpenAI


# You can paste your API key directly here for quick local testing.
# Leave empty to fall back to OPENAI_API_KEY from environment variables.
API_KEY = ""


def generate_gift_basket(client: OpenAI) -> None:
    prompt = """
Generate a photorealistic image of a gift basket on a white background
labeled 'Relax & Unwind' with a ribbon and handwriting-like font,
containing all the items in the reference pictures.
""".strip()

    image_paths = [
        "body-lotion.png",
        "bath-bomb.png",
        "incense-kit.png",
        "soap.png",
    ]

    missing = [path for path in image_paths if not os.path.exists(path)]
    if missing:
        raise FileNotFoundError(
            "Missing input image files: " + ", ".join(missing)
        )

    with open(image_paths[0], "rb") as img1, open(image_paths[1], "rb") as img2, open(
        image_paths[2], "rb"
    ) as img3, open(image_paths[3], "rb") as img4:
        result = client.images.edit(
            model="gpt-image-2",
            image=[img1, img2, img3, img4],
            prompt=prompt,
        )

    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)

    output_path = "gift-basket.png"
    with open(output_path, "wb") as f:
        f.write(image_bytes)

    print(f"Saved generated image to {output_path}")


def parse_moments_from_appjs(appjs_path: Path) -> list[dict[str, str]]:
    text = appjs_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\{\s*"
        r"ts:\s*\"(?P<ts>[^\"]+)\",[\s\S]*?"
        r"segment:\s*\"(?P<segment>[^\"]+)\",[\s\S]*?"
        r"subtitle:\s*\"(?P<subtitle>[^\"]+)\",[\s\S]*?"
        r"topic:\s*\"(?P<topic>[^\"]+)\",",
        re.MULTILINE,
    )
    matches = [m.groupdict() for m in pattern.finditer(text)]
    if not matches:
        raise ValueError(f"No scenes parsed from {appjs_path}")
    return matches


def slugify(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower())
    return cleaned.strip("-") or "scene"


def build_scene_prompt(scene: dict[str, str]) -> str:
    return (
        "Create a photorealistic still image from a professional basketball live broadcast. "
        f"Scene: {scene['segment']}. "
        f"Current topic: {scene['topic']}. "
        f"Commentary line: {scene['subtitle']} "
        "Show realistic arena lighting, players in motion, crowd depth, and broadcast-camera composition. "
        "The frame should look like a real TV live stream still. "
        "No text overlays, no watermarks, no logos, no score bug."
    )


def generate_scene_images(
    client: OpenAI,
    appjs_path: Path,
    output_dir: Path,
    limit: int | None,
) -> None:
    scenes = parse_moments_from_appjs(appjs_path)
    if limit is not None:
        scenes = scenes[:limit]

    output_dir.mkdir(parents=True, exist_ok=True)

    for index, scene in enumerate(scenes, start=1):
        prompt = build_scene_prompt(scene)
        result = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size="1024x1024",
        )
        image_base64 = result.data[0].b64_json
        image_bytes = base64.b64decode(image_base64)
        filename = f"scene_{index:02d}_{slugify(scene['segment'])}.png"
        output_path = output_dir / filename
        output_path.write_bytes(image_bytes)
        print(f"[{index}/{len(scenes)}] Saved {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate images using gpt-image-2 for either the gift basket demo or live stream scene mocks."
    )
    parser.add_argument(
        "--mode",
        choices=["basket", "scenes"],
        default="scenes",
        help="basket: use reference image edit demo; scenes: generate one image per scene in app.js",
    )
    parser.add_argument(
        "--appjs",
        default="app.js",
        help="Path to app.js that contains the moments scene list",
    )
    parser.add_argument(
        "--out",
        default="mock_stream_images",
        help="Output directory for generated scene images",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional: only generate the first N scene images",
    )

    args = parser.parse_args()

    api_key = API_KEY.strip() or os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise EnvironmentError(
            "API key not found. Set API_KEY in this file or export OPENAI_API_KEY."
        )

    client = OpenAI(api_key=api_key)

    if args.mode == "basket":
        generate_gift_basket(client)
        return

    generate_scene_images(
        client=client,
        appjs_path=Path(args.appjs),
        output_dir=Path(args.out),
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
