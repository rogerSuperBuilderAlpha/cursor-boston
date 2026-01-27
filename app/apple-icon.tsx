import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          borderRadius: "32px",
        }}
      >
        {/* Stylized cursor/arrow icon */}
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          style={{ transform: "rotate(-45deg)" }}
        >
          <path
            d="M5 3l14 9-6 2-3 6-5-17z"
            fill="#10b981"
            stroke="#10b981"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
