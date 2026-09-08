export default function handler(_req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    status: "healthy",
    service: "routeguard-vercel-api",
    timestamp: Date.now()
  });
}
