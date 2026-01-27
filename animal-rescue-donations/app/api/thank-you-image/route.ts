import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { jsx, jsxs } from "react/jsx-runtime";

export const runtime = "edge";

// Background image list — exactly matching your /public/images/backgrounds folder
const backgrounds = [
  "/images/backgrounds/barkbase_pattern_1.png",
  "/images/backgrounds/barkbase_pattern_2.png",
  "/images/backgrounds/barkbase_pattern_3.png",
  "/images/backgrounds/barkbase_pattern_4.png",
  "/images/backgrounds/barkbase_pattern_5.png",
  "/images/backgrounds/cosmic_purple_space.png",
  "/images/backgrounds/playful_pattern_1.png",
  "/images/backgrounds/playful_pattern_2.png",
  "/images/backgrounds/playful_pattern_4.png",
  "/images/backgrounds/playful_pattern_6.png",
  "/images/backgrounds/purple_gold_metallic.png",
  "/images/backgrounds/tech_metal_green.png",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const wallet = searchParams.get("wallet") || "anon";
  const amount = searchParams.get("amount") || "?";
  const tokenType = searchParams.get("token") || "ETH";

  let barkrMessage = "Tail wags and vault snacks, hero!"; // fallback message

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are Barkr, a heroic, witty rescue mutt AI. Write a short (max 20 words) thank-you line for a donor. Mention dogs, biscuits, or saving lives. Must be in your voice—funny, heartfelt, slightly unhinged, and grateful.",
          },
          {
            role: "user",
            content: `A donor just gave ${amount} ${tokenType} from wallet ${wallet}.`,
          },
        ],
        temperature: 0.85,
      }),
    });

    const json = await openaiRes.json();
    barkrMessage = json.choices?.[0]?.message?.content?.trim() || barkrMessage;
  } catch (err) {
    console.error("OpenAI error:", err);
  }
  
  const bgIndex = Math.floor(Math.random() * backgrounds.length);

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://barkbase.xyz";
  const imageUrl = `${base}${backgrounds[bgIndex]}`;
  const barkrUrl = `${base}/images/barkr.png`;

  return new ImageResponse(
    jsxs("div", {
      style: {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        width: "1200px",
        height: "630px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "sans-serif",
      },
      children: [
        jsx("div", {
          style: {
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            borderRadius: "20px",
            padding: "40px",
            textAlign: "center",
            color: "white",
            boxShadow: "0 0 20px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          },
          children: [
            jsx("div", {
              style: { fontSize: 64, fontWeight: 800 },
              children: "🐶 Thank You!",
            }),

            jsx("div", {
              style: { fontSize: 28, fontStyle: "italic", maxWidth: "700px" },
              children: barkrMessage,
            }),
            
            jsx("div", {
              style: { fontSize: 32 },
              children: `Wallet: ${wallet}`,
            }),
            jsx("div", {
              style: { fontSize: 32 },
              children: `Donation: ${amount} ${tokenType}`,
            }),
          ]
        }),
        jsx("img", {
          src: barkrUrl,
          style: {
            width: "300px",
            position: "absolute",
            bottom: "40px",
            right: "40px",
          }
        })
      ]
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}
