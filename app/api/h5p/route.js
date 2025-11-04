export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { H5PPlayer, LocalLibraryStorage, LocalContentStorage } from '@lumieducation/h5p-server';

const contentStorage = new LocalContentStorage('./h5p-content');
const libraryStorage = new LocalLibraryStorage('./h5p-libraries');

const player = new H5PPlayer(libraryStorage, contentStorage);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || 'practice-questions';

  try {
    const html = await player.render(id);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'H5P render failed' }, { status: 500 });
  }
}