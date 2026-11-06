import { NextResponse } from 'next/server';

/** Unknown API paths answer in JSON like the rest of the API, instead of falling through to the shop's 404 page. */
const missing = () => NextResponse.json({ error: 'not found' }, { status: 404 });

export { missing as GET, missing as POST, missing as PUT, missing as PATCH, missing as DELETE, missing as OPTIONS };
