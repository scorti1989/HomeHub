'use strict';
let concerts     = load('vh_concerts', []);
let venues       = load('vh_venues', {});
let cities       = load('vh_cities', {});
let ticketPeople = load('vh_ticketpeople', []);

// Migriert alte "venues" (Location-basiert) in die neue "cities"-Struktur mit Aspekten
function migrateCitiesV2() {
  // Alte Struktur cities[stadt] = {maps,note,aspects}  ->  cities[stadt] = {note, venues:{venueName:{maps,note,aspects}}}
  Object.keys(cities).forEach(cn => {
    const c = cities[cn];
    if (c && c.venues) return;                          // schon neue Struktur
    const oldAspects = (c && c.aspects) || {};
    const oldMaps = (c && c.maps) || '';
    const oldNote = (c && c.note) || '';
    // Venue-Name aus einem Konzert dieser Stadt ableiten, sonst Stadtname
    const conc = concerts.find(k => k.city === cn && k.venueId);
    const venueName = conc ? conc.venueId : (cn + ' (Venue)');
    cities[cn] = { note: '', venues: {} };
    cities[cn].venues[venueName] = { maps: oldMaps, note: oldNote, aspects: oldAspects };
  });
  save('vh_cities', cities);
}
function migrateCitiesFromVenues() {
  if (!venues || typeof venues !== 'object' || Array.isArray(venues)) return;

  Object.keys(venues).forEach(vn => {
    const v = venues[vn];
    if (!v || typeof v !== 'object') return;

    const parts = String(vn)
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    const cityName = parts.length > 1
      ? parts[parts.length - 1]
      : vn;

    const venueName = parts.length > 1
      ? parts.slice(0, -1).join(', ')
      : vn;

    if (!cities[cityName] || typeof cities[cityName] !== 'object') {
      cities[cityName] = { note: '', venues: {} };
    }

    const city = cities[cityName];

    if (!city.venues || typeof city.venues !== 'object' || Array.isArray(city.venues)) {
      city.venues = {};
    }

    if (!city.venues[venueName] || typeof city.venues[venueName] !== 'object') {
      city.venues[venueName] = {
        maps: '',
        note: '',
        aspects: {}
      };
    }

    const target = city.venues[venueName];

    if (!target.aspects || typeof target.aspects !== 'object' || Array.isArray(target.aspects)) {
      target.aspects = {};
    }

    if (v.maps && !target.maps) {
      target.maps = v.maps;
    }

    if (v.note && !(target.note && target.note.includes(v.note))) {
      target.note = target.note
        ? target.note + ' · ' + v.note
        : v.note;
    }

    if (v.parking || v.parkCost) {
      target.aspects.parking = target.aspects.parking || {
        rating: 0,
        note: [v.parking, v.parkCost].filter(Boolean).join(' · ')
      };
    }

    if (v.food) {
      target.aspects.food = target.aspects.food || {
        rating: 0,
        note: v.food
      };
    }

    if (v.payment) {
      target.aspects.prices = target.aspects.prices || {
        rating: 0,
        note: 'Zahlung: ' + v.payment
      };
    }

    if (v.storage) {
      target.aspects.wardrobe = target.aspects.wardrobe || {
        rating: 0,
        note: v.storage
      };
    }
  });

  concerts.forEach(k => {
    if (!k || typeof k !== 'object') return;

    if (!k.city && k.venueId) {
      const parts = String(k.venueId)
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);

      if (parts.length > 1) {
        k.city = parts[parts.length - 1];
        k.venueId = parts.slice(0, -1).join(', ');
      } else if (cities[k.venueId]) {
        k.city = k.venueId;
      }
    }
  });

  save('vh_cities', cities);
  save('vh_concerts', concerts);
}
migrateCitiesFromVenues();
migrateCitiesV2();

