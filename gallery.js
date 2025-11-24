
// netlify/functions/gallery.js
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder    = process.env.CLOUDINARY_FOLDER || ''; // leave blank to search all uploads
    const { next_cursor } = event.queryStringParameters || {};

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;

    // If you want to restrict to a folder, ensure uploads land there (via your preset),
    // then set CLOUDINARY_FOLDER in Netlify and use the folder expression below.
    const expression = folder
      ? `folder=${folder} AND resource_type:image AND type=upload`
      : `resource_type:image AND type=upload`;

    const params = new URLSearchParams({
      expression,
      max_results: '100',
      // IMPORTANT: sort_by must be JSON array string
      sort_by: JSON.stringify([{ created_at: 'desc' }])
    });
    if (next_cursor) params.append('next_cursor', next_cursor);

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: text }) };
    }

    const data = await resp.json();

    const files = (data.resources || []).map(r => ({
      url: r.secure_url,
      name: r.public_id.split('/').pop(),
      bytes: r.bytes,
      format: r.format,
      created_at: r.created_at
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ files, next_cursor: data.next_cursor || null })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
