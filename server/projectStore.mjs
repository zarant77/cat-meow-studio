const defaultProjectId = "cat-meow-studio";
const defaultProjectName = "Cat Meow Studio";

export function loadProjectState(db, userId) {
  const project = getAccessibleProjectRow(db, userId, null);

  if (project === undefined) {
    return createAndLoadProjectState(db, userId, defaultProjectName, defaultProjectId);
  }

  return loadProjectStateByStorageId(db, userId, String(project.id));
}

export function loadProjectStateByStorageId(db, userId, storageProjectId, isAdmin = false) {
  const projectRow = getAccessibleProjectRow(db, userId, storageProjectId, isAdmin);

  if (projectRow === undefined) {
    throw new Error("Project not found.");
  }

  return readProjectState(db, projectRow);
}

export function listProjectSummaries(db, userId) {
  return db.prepare(`
    SELECT projects.id, projects.project_id, projects.name, users.email AS owner_email
    FROM projects
    JOIN users ON users.id = projects.user_id
    LEFT JOIN project_users ON project_users.project_id = projects.id
    WHERE projects.user_id = ? OR project_users.user_id = ?
    GROUP BY projects.id
    ORDER BY projects.created_at ASC
  `).all(userId, userId).map(toProjectSummary);
}

export function listAllProjectSummaries(db) {
  return db.prepare(`
    SELECT projects.id, projects.project_id, projects.name, users.email AS owner_email
    FROM projects
    JOIN users ON users.id = projects.user_id
    ORDER BY projects.created_at ASC
  `).all().map(toProjectSummary);
}

export function createProjectForUser(db, userId, name, projectId) {
  const cleanName = typeof name === "string" && name.trim() !== "" ? name.trim() : defaultProjectName;
  const cleanProjectId = typeof projectId === "string" && projectId.trim() !== "" ? toProjectId(projectId) : toProjectId(cleanName);
  const storageProjectId = `${userId}:${cleanProjectId}`;
  const state = createDefaultProjectState(cleanProjectId, cleanName);
  saveProjectStateByStorageId(db, userId, storageProjectId, state);
  return loadProjectStateByStorageId(db, userId, storageProjectId);
}

export function saveProjectState(db, userId, state) {
  const project = getAccessibleProjectRow(db, userId, null);
  const storageProjectId = project === undefined ? `${userId}:${state.project.id}` : String(project.id);
  saveProjectStateByStorageId(db, userId, storageProjectId, state);
}

export function saveProjectStateByStorageId(db, userId, storageProjectId, state, isAdmin = false) {
  const accessibleProject = getAccessibleProjectRow(db, userId, storageProjectId, isAdmin);
  const existingAnyProject = db.prepare("SELECT id FROM projects WHERE id = ?").get(storageProjectId);

  if (existingAnyProject !== undefined && accessibleProject === undefined) {
    throw new Error("Project not found.");
  }

  const ownerId = accessibleProject === undefined ? userId : String(accessibleProject.user_id);
  const timestamp = new Date().toISOString();
  const tx = db.transaction(() => {
    const existingProject = db.prepare("SELECT created_at FROM projects WHERE id = ?").get(storageProjectId);
    const createdAt = existingProject?.created_at ?? timestamp;

    db.prepare(`
      INSERT INTO projects (
        id,
        project_id,
        user_id,
        name,
        selected_sprite_asset_id,
        selected_music_asset_id,
        selected_sfx_asset_id,
        active_mode,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        name = excluded.name,
        selected_sprite_asset_id = excluded.selected_sprite_asset_id,
        selected_music_asset_id = excluded.selected_music_asset_id,
        selected_sfx_asset_id = excluded.selected_sfx_asset_id,
        active_mode = excluded.active_mode,
        updated_at = excluded.updated_at
    `).run(
      storageProjectId,
      state.project.id,
      ownerId,
      state.project.name,
      state.selectedAssetIds.sprite,
      state.selectedAssetIds.music,
      state.selectedAssetIds.sfx,
      state.activeMode,
      createdAt,
      timestamp,
    );

    db.prepare("DELETE FROM assets WHERE project_id = ?").run(storageProjectId);
    db.prepare("DELETE FROM sprite_palette_colors WHERE project_id = ?").run(storageProjectId);

    const insertAsset = db.prepare(`
      INSERT INTO assets (id, project_id, kind, name, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const asset of state.project.assets) {
      insertAsset.run(
        asset.id,
        storageProjectId,
        asset.kind,
        asset.name,
        JSON.stringify(toAssetPayload(asset)),
        asset.createdAt,
        asset.updatedAt,
      );
    }

    const insertColor = db.prepare(`
      INSERT INTO sprite_palette_colors (project_id, palette_index, name, rgba)
      VALUES (?, ?, ?, ?)
    `);

    state.project.spritePalette.slice(0, 256).forEach((color, index) => {
      insertColor.run(storageProjectId, index, color.name, color.rgba);
    });
  });

  tx();
}

export function listProjectUserIds(db, storageProjectId) {
  const owner = db.prepare("SELECT user_id FROM projects WHERE id = ?").get(storageProjectId);
  const memberRows = db.prepare("SELECT user_id FROM project_users WHERE project_id = ?").all(storageProjectId);
  const userIds = new Set(memberRows.map((row) => String(row.user_id)));

  if (owner !== undefined) {
    userIds.add(String(owner.user_id));
  }

  return [...userIds];
}

export function addProjectUser(db, storageProjectId, userId) {
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO project_users (project_id, user_id, created_at)
    VALUES (?, ?, ?)
  `).run(storageProjectId, userId, timestamp);
}

export function removeProjectUser(db, storageProjectId, userId) {
  db.prepare("DELETE FROM project_users WHERE project_id = ? AND user_id = ?").run(storageProjectId, userId);
}

export function renameProject(db, storageProjectId, name) {
  const nextName = typeof name === "string" ? name.trim() : "";

  if (nextName === "") {
    throw new Error("Project name is required.");
  }

  db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(nextName, new Date().toISOString(), storageProjectId);
}

function createAndLoadProjectState(db, userId, name, projectId) {
  const created = createProjectForUser(db, userId, name, projectId);
  return created;
}

function readProjectState(db, projectRow) {
  const storageProjectId = String(projectRow.id);
  const assets = db.prepare(`
    SELECT id, kind, name, payload, created_at, updated_at
    FROM assets
    WHERE project_id = ?
    ORDER BY created_at ASC
  `).all(storageProjectId).map(toProjectAsset);

  const spritePalette = db.prepare(`
    SELECT name, rgba
    FROM sprite_palette_colors
    WHERE project_id = ?
    ORDER BY palette_index ASC
  `).all(storageProjectId).map((row) => ({
    name: String(row.name),
    rgba: String(row.rgba),
  }));

  return {
    storageProjectId,
    project: {
      id: String(projectRow.project_id),
      name: String(projectRow.name),
      spritePalette: spritePalette.length === 0 ? createDefaultSpritePalette() : spritePalette,
      assets,
    },
    selectedAssetIds: {
      sprite: toNullableString(projectRow.selected_sprite_asset_id),
      music: toNullableString(projectRow.selected_music_asset_id),
      sfx: toNullableString(projectRow.selected_sfx_asset_id),
    },
    activeMode: toAppMode(projectRow.active_mode),
  };
}

function getAccessibleProjectRow(db, userId, storageProjectId, isAdmin = false) {
  if (storageProjectId !== null) {
    if (isAdmin) {
      return db.prepare("SELECT projects.* FROM projects WHERE projects.id = ? LIMIT 1").get(storageProjectId);
    }

    return db.prepare(`
      SELECT projects.*
      FROM projects
      LEFT JOIN project_users ON project_users.project_id = projects.id
      WHERE projects.id = ? AND (projects.user_id = ? OR project_users.user_id = ?)
      LIMIT 1
    `).get(storageProjectId, userId, userId);
  }

  const projectRow = db.prepare(`
    SELECT projects.*
    FROM projects
    LEFT JOIN project_users ON project_users.project_id = projects.id
    WHERE projects.user_id = ? OR project_users.user_id = ?
    GROUP BY projects.id
    ORDER BY projects.created_at ASC
    LIMIT 1
  `).get(userId, userId);

  return projectRow;
}

export function createDefaultProjectState(projectId = defaultProjectId, name = defaultProjectName) {
  return {
    project: {
      id: projectId,
      name,
      spritePalette: createDefaultSpritePalette(),
      assets: [],
    },
    selectedAssetIds: {
      sprite: null,
      music: null,
      sfx: null,
    },
    activeMode: "sfx",
  };
}

function toProjectSummary(row) {
  return {
    storageProjectId: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    ownerEmail: String(row.owner_email),
  };
}

function toProjectId(value) {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return id === "" ? defaultProjectId : id;
}

function toProjectAsset(row) {
  const kind = toAssetKind(row.kind);
  const base = {
    id: String(row.id),
    kind,
    name: String(row.name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
  const payload = JSON.parse(String(row.payload));

  if (kind === "sprite") {
    return {
      ...base,
      kind,
      sprite: payload,
    };
  }

  if (kind === "music") {
    return {
      ...base,
      kind,
      music: payload,
    };
  }

  return {
    ...base,
    kind,
    sfx: payload,
  };
}

function toAssetPayload(asset) {
  if (asset.kind === "sprite") {
    return asset.sprite;
  }

  if (asset.kind === "music") {
    return asset.music;
  }

  return asset.sfx;
}

function toAssetKind(value) {
  if (value === "sprite" || value === "music" || value === "sfx") {
    return value;
  }

  throw new Error(`Unknown asset kind: ${String(value)}`);
}

function toAppMode(value) {
  if (value === "music" || value === "sfx" || value === "sprites") {
    return value;
  }

  return "sfx";
}

function toNullableString(value) {
  return typeof value === "string" ? value : null;
}

function createDefaultSpritePalette() {
  return [
    { name: "Transparent", rgba: "#00000000" },
    { name: "Ink", rgba: "#111111ff" },
    { name: "White", rgba: "#ffffffff" },
  ];
}
