#!/usr/bin/env node
/**
 * Test script: Parse a Rekordbox ANLZ file and examine its contents
 *
 * Goal: Determine if ANLZ files contain metadata we can use to correlate
 * with XML tracks (duration, BPM, file path, etc.)
 */

const fs = require('fs');
const path = require('path');
const RekordboxAnlz = require('rekordbox-parser');

// Test file path
const anlzPath = '/mnt/c/Users/Thoma/AppData/Roaming/Pioneer/rekordbox/share/PIONEER/USBANLZ/000/043b1-91d8-436a-8201-f38d33081b5f/ANLZ0000.EXT';

console.log('🔬 ANLZ File Analysis');
console.log('='.repeat(60));
console.log(`File: ${anlzPath}`);
console.log(`UUID: 043b1-91d8-436a-8201-f38d33081b5f`);
console.log('='.repeat(60));

try {
  // Read the file
  const anlzData = fs.readFileSync(anlzPath);
  console.log(`✅ File size: ${anlzData.length.toLocaleString()} bytes`);

  // Parse with rekordbox-parser
  const parsed = RekordboxAnlz.parseAnlz(anlzData);

  console.log('\n📦 Parsed Structure:');
  console.log(`  Type: ${typeof parsed}`);
  console.log(`  Keys: ${Object.keys(parsed).join(', ')}`);

  console.log('\n📋 Sections Found:');
  if (parsed.sections && Array.isArray(parsed.sections)) {
    parsed.sections.forEach((section, idx) => {
      // Convert fourcc number to string
      const fourccStr = section.fourcc
        ? String.fromCharCode(
            (section.fourcc >> 24) & 0xFF,
            (section.fourcc >> 16) & 0xFF,
            (section.fourcc >> 8) & 0xFF,
            section.fourcc & 0xFF
          )
        : 'unknown';
      console.log(`  ${idx + 1}. ${fourccStr} (fourcc: ${section.fourcc}, len: ${section.len} bytes)`);
    });
  } else {
    console.log('  No sections array found');
  }

  // Look for specific sections
  console.log('\n🔍 Looking for key sections:');

  // Helper to convert string to fourcc number
  const strToFourcc = (str) => {
    return (str.charCodeAt(0) << 24) | (str.charCodeAt(1) << 16) | (str.charCodeAt(2) << 8) | str.charCodeAt(3);
  };

  // Check for waveform sections
  const pwv4 = parsed.sections?.find(s => s.fourcc === strToFourcc('PWV4'));
  const pwv5 = parsed.sections?.find(s => s.fourcc === strToFourcc('PWV5'));
  const beatGrid = parsed.sections?.find(s => s.fourcc === strToFourcc('PQTZ'));
  const cues = parsed.sections?.find(s => s.fourcc === strToFourcc('PCOB'));

  console.log(`  PWV4 (Color Preview):  ${pwv4 ? '✅ Found' : '❌ Not found'}`);
  console.log(`  PWV5 (Color Detail):   ${pwv5 ? '✅ Found' : '❌ Not found'}`);
  console.log(`  PQTZ (Beat Grid):      ${beatGrid ? '✅ Found' : '❌ Not found'}`);
  console.log(`  PCOB (Cues):           ${cues ? '✅ Found' : '❌ Not found'}`);

  // Check PPTH section for file path
  const ppth = parsed.sections?.find(s => s.fourcc === strToFourcc('PPTH'));
  if (ppth && ppth.body) {
    console.log('\n📁 PPTH (File Path) Data:');
    console.log(`  Body keys: ${Object.keys(ppth.body).join(', ')}`);
    if (ppth.body.path) {
      console.log(`  Path: ${ppth.body.path}`);
    } else {
      console.log(`  Body: ${JSON.stringify(ppth.body).substring(0, 300)}`);
    }
  }

  // If PWV5 exists, show waveform data sample
  if (pwv5) {
    console.log('\n🎨 PWV5 Waveform Data Sample:');
    console.log(`  Section length: ${pwv5.len} bytes`);
    if (pwv5.body) {
      console.log(`  Body keys: ${Object.keys(pwv5.body).join(', ')}`);

      // Try to access waveform entries
      if (pwv5.body.entries) {
        const totalEntries = pwv5.body.entries.length;
        const durationSec = totalEntries / 150; // 150 entries per second
        const durationMin = Math.floor(durationSec / 60);
        const durationRemainingSec = Math.floor(durationSec % 60);

        console.log(`  Entries count: ${totalEntries.toLocaleString()}`);
        console.log(`  Duration: ${durationMin}:${durationRemainingSec.toString().padStart(2, '0')} (${durationSec.toFixed(1)}s)`);
        console.log(`  First 5 entries (decoded):`);

        pwv5.body.entries.slice(0, 5).forEach((entry, i) => {
          // Decode the 16-bit packed value
          const red = (entry >> 13) & 0x07;
          const green = (entry >> 10) & 0x07;
          const blue = (entry >> 7) & 0x07;
          const height = (entry >> 2) & 0x1F;

          // Scale to 8-bit
          const red8 = Math.round((red * 255) / 7);
          const green8 = Math.round((green * 255) / 7);
          const blue8 = Math.round((blue * 255) / 7);

          console.log(`    ${i + 1}. Raw: ${entry} → RGB(${red8}, ${green8}, ${blue8}), Height: ${height}`);
        });
      } else if (pwv5.body.waveform) {
        console.log(`  Waveform data: ${typeof pwv5.body.waveform}`);
      } else {
        console.log(`  Body structure: ${JSON.stringify(pwv5.body).substring(0, 200)}...`);
      }
    }
  }

  // If beat grid exists, show tempo data
  if (beatGrid && beatGrid.body) {
    console.log('\n🎵 Beat Grid Data:');
    console.log(`  Body keys: ${Object.keys(beatGrid.body).join(', ')}`);
    if (beatGrid.body.beats) {
      console.log(`  Beats count: ${beatGrid.body.beats.length}`);
      console.log(`  First beat: ${JSON.stringify(beatGrid.body.beats[0])}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Analysis complete!');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
