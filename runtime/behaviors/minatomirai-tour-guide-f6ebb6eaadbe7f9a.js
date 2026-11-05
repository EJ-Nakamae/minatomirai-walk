const SPOTS = [
  { id: 1, name: "横浜赤レンガ倉庫", description: "明治・大正期の倉庫を活用した文化・商業施設。海辺の散策やイベントも楽しめます。", longitude: 139.643013816, latitude: 35.452364034 },
  { id: 2, name: "横浜ランドマークタワー", description: "みなとみらいを象徴する高層ビル。展望フロアから港と市街を一望できます。", longitude: 139.63143413, latitude: 35.454595435 },
  { id: 3, name: "よこはまコスモワールド", description: "大観覧車「コスモクロック21」が目印の都市型遊園地です。", longitude: 139.635017968, latitude: 35.455802038 },
  { id: 4, name: "カップヌードルミュージアム 横浜", description: "発明と創造の楽しさを体験できるミュージアム。オリジナルのカップヌードル作りも人気です。", longitude: 139.638899441, latitude: 35.45549734 },
  { id: 5, name: "横浜ハンマーヘッド", description: "客船ターミナル、ホテル、ショップが集まる海辺の複合施設です。", longitude: 139.641784541, latitude: 35.456044761 },
  { id: 6, name: "帆船日本丸", description: "かつて航海訓練に使われた美しい帆船。隣接する博物館とともに港の歴史を伝えます。", longitude: 139.632331028, latitude: 35.453741812 }
];

export default async function install(app) {
  const [FeatureLayer, Graphic, Basemap] = await Promise.all([
    app.import("esri/layers/FeatureLayer"),
    app.import("esri/Graphic"),
    app.import("esri/Basemap")
  ]);

  const features = SPOTS.map((spot) => new Graphic({
    geometry: { type: "point", longitude: spot.longitude, latitude: spot.latitude, spatialReference: { wkid: 4326 } },
    attributes: spot
  }));

  const layer = new FeatureLayer({
    id: "minatomirai-spots",
    title: "みなとみらい観光スポット",
    source: features,
    objectIdField: "id",
    geometryType: "point",
    spatialReference: { wkid: 4326 },
    fields: [
      { name: "id", alias: "ID", type: "oid" },
      { name: "name", alias: "名称", type: "string" },
      { name: "description", alias: "紹介", type: "string", length: 400 },
      { name: "longitude", alias: "経度", type: "double" },
      { name: "latitude", alias: "緯度", type: "double" }
    ],
    renderer: {
      type: "simple",
      symbol: { type: "simple-marker", style: "circle", color: "#e66b55", size: 12, outline: { color: "#fff8ec", width: 2 } }
    },
    popupTemplate: { title: "{name}", content: [{ type: "text", text: "{description}" }] }
  });
  app.map.add(layer);
  await layer.load();

  await app.view.goTo({ center: app.config.initialCenter, zoom: app.config.initialZoom }, { animate: false });

  const mount = app.getMount("minatomirai-guide");
  mount.style.setProperty("min-width", "0");
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { display: "grid", gap: "14px", padding: "2px 0 8px", minWidth: "0" });

  const intro = document.createElement("p");
  intro.textContent = "港の景色を楽しみながら歩ける、6つの見どころです。名前を選ぶと地図が移動します。";
  Object.assign(intro.style, { margin: "0", color: "var(--app-text-muted)", lineHeight: "1.7", fontSize: "0.92rem" });

  const mapStyleLabel = document.createElement("calcite-label");
  mapStyleLabel.textContent = "背景地図";
  mapStyleLabel.style.margin = "0";
  const basemapControl = document.createElement("calcite-segmented-control");
  basemapControl.setAttribute("width", "full");
  basemapControl.setAttribute("scale", "m");
  basemapControl.setAttribute("label", "背景地図を選択");
  const topo = document.createElement("calcite-segmented-control-item");
  topo.setAttribute("value", "topo-vector");
  topo.setAttribute("checked", "");
  topo.textContent = "地形図";
  const satellite = document.createElement("calcite-segmented-control-item");
  satellite.setAttribute("value", "satellite");
  satellite.textContent = "衛星画像";
  basemapControl.append(topo, satellite);
  mapStyleLabel.append(basemapControl);

  const divider = document.createElement("div");
  divider.setAttribute("aria-hidden", "true");
  Object.assign(divider.style, { height: "2px", background: "linear-gradient(90deg, var(--app-accent), transparent)", opacity: "0.75" });

  const list = document.createElement("calcite-list");
  list.setAttribute("label", "観光スポット一覧");
  list.setAttribute("selection-mode", "single");
  list.setAttribute("scale", "m");

  const focusSpot = async (id) => {
    const spot = SPOTS.find((entry) => entry.id === Number(id));
    const feature = features.find((entry) => entry.attributes.id === Number(id));
    app.assert(spot && feature, "指定されたスポットが見つかりません。");
    await app.view.goTo({ target: feature.geometry, zoom: 17 }, { duration: 650 });
    app.view.openPopup({ features: [feature], location: feature.geometry });
    return { id: spot.id, name: spot.name, zoom: app.view.zoom, popupVisible: app.view.popup?.visible === true };
  };

  const switchBasemap = async (id) => {
    const basemapId = id === "satellite" ? "satellite" : "topo-vector";
    const next = Basemap.fromId(basemapId);
    await next.load();
    app.map.basemap = next;
    return { basemapId, title: next.title };
  };

  const items = SPOTS.map((spot, index) => {
    const item = document.createElement("calcite-list-item");
    item.setAttribute("label", spot.name);
    item.setAttribute("description", spot.description);
    item.setAttribute("value", String(spot.id));
    item.setAttribute("icon-start", index === 2 ? "compass" : "pin");
    const onSelect = () => { if (item.selected) void focusSpot(spot.id); };
    item.addEventListener("calciteListItemSelect", onSelect);
    app.onCleanup(() => item.removeEventListener("calciteListItemSelect", onSelect));
    return item;
  });
  list.append(...items);
  wrap.append(intro, mapStyleLabel, divider, list);
  mount.replaceChildren(wrap);

  const onBasemapChange = (event) => { void switchBasemap(event.target.value); };
  basemapControl.addEventListener("calciteSegmentedControlChange", onBasemapChange);
  const focusRegistration = app.actions.register("focus-minatomirai-spot", ({ id }) => focusSpot(id));
  const basemapRegistration = app.actions.register("switch-minatomirai-basemap", ({ id }) => switchBasemap(id));

  app.onCleanup(() => {
    basemapControl.removeEventListener("calciteSegmentedControlChange", onBasemapChange);
    focusRegistration.remove();
    basemapRegistration.remove();
    mount.replaceChildren();
  });

  return { spotCount: SPOTS.length, layerId: layer.id, initialZoom: app.view.zoom, center: app.config.initialCenter };
}