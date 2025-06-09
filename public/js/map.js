console.log("✅ map.js is connected to show.ejs");

   mapboxgl.accessToken =  mapToken;
   
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: listing.geometry.coordinates,
        zoom: 9,
    });
    console.log(listing.geometry.coordinates);

 const marker2 = new mapboxgl.Marker({ color: 'red' })
        .setLngLat(listing.geometry.coordinates)
        .setPopup(new mapboxgl.Popup({offset: 25 })
        .setHTML(`<h4>${listing.location}</h4>Exact Location Provided after booking.`))
        .addTo(map);