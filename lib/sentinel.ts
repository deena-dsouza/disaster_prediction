export const getSentinelImageUrl = async (
  lat: number,
  lon: number
): Promise<string> => {
  /* 1️⃣  fetch token from your own backend (POST, not GET) */
  const tokenRes = await fetch("/api/sentinel-token", { method: "POST" });
  if (!tokenRes.ok) throw new Error("Failed to fetch Sentinel token");
  const { token } = await tokenRes.json();

  /* 2️⃣  call Sentinel Hub Process API with that token */
  const response = await fetch("https://services.sentinel-hub.com/api/v1/process", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        bounds: {
          bbox: [lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05],
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
        },
        data: [
          {
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: {
                from: "2023-06-01T00:00:00Z",
                to: "2023-06-30T23:59:59Z",
              },
            },
          },
        ],
      },
      output: {
        width: 512,
        height: 512,
        responses: [
          { identifier: "default", format: { type: "image/jpeg" } },
        ],
      },
      evalscript: `//VERSION=3
        function setup(){return{input:["B04","B03","B02"],output:{bands:3}}}
        function evaluatePixel(s){return[s.B04,s.B03,s.B02];}`,
    }),
  });

  if (!response.ok) throw new Error("Sentinel image request failed");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
