package com.pokemonwithfriends.game;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.util.*;
import java.util.zip.*;

/** Immutable, validated private asset pack. No game resources are downloaded. */
final class TownPack {
    static final int MAX_PACK_BYTES = 20 * 1024 * 1024;
    final Bitmap background;
    final short[] depth;
    final Bitmap[] sheets;
    final String[] names, roles, collision;
    final int width, height, originX, originY, spawnX, spawnY;
    final float pixelsPerUnit;

    TownPack(InputStream input) throws Exception {
        Map<String, byte[]> files = new HashMap<>();
        int total = 0;
        try (ZipInputStream zip = new ZipInputStream(input)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (entry.isDirectory() || !name.matches("[a-zA-Z0-9_.-]+"))
                    throw new IOException("Ungültiger Paketinhalt");
                if (files.size() >= 32 || files.containsKey(name))
                    throw new IOException("Zu viele oder doppelte Dateien");
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192]; int n;
                while ((n = zip.read(buffer)) != -1) {
                    total += n;
                    if (total > MAX_PACK_BYTES) throw new IOException("Paket ist zu groß");
                    out.write(buffer, 0, n);
                }
                files.put(name, out.toByteArray());
            }
        }
        JSONObject meta = new JSONObject(new String(required(files,"manifest.json"), "UTF-8"));
        if (!"pwf-heartgold-town".equals(meta.getString("format")) || meta.getInt("version") != 1
            || !"IPKD".equals(meta.getString("gameCode")) || meta.getInt("landId") != 0)
            throw new IOException("Kein passendes HeartGold-Neuborkia-Paket");
        width = meta.getInt("imageWidth"); height = meta.getInt("imageHeight");
        if (width != 1152 || height != 1152 || meta.getInt("tileSize") != 16
            || meta.getInt("groundY") != 16) throw new IOException("Ungültige Kartengröße");
        originX = meta.getJSONArray("origin").getInt(0);
        originY = meta.getJSONArray("origin").getInt(1);
        pixelsPerUnit = (float)meta.getDouble("pixelsPerUnit");
        if (originX != 576 || originY != 640 || pixelsPerUnit != 2f)
            throw new IOException("Unbekannte Kartenprojektion");
        background = bitmap(required(files, "neuborkia.png"), width, height);
        byte[] raw = required(files, "depth.bin");
        if (raw.length != width * height * 2) throw new IOException("Tiefenkarte fehlt");
        depth = new short[width * height];
        for (int i = 0; i < depth.length; i++) depth[i] = (short)((raw[i*2]&255) | ((raw[i*2+1]&255)<<8));
        JSONArray grid = meta.getJSONArray("collision");
        if (grid.length() != 32) throw new IOException("Kollisionen fehlen");
        collision = new String[32];
        for (int i=0;i<32;i++) {
            collision[i]=grid.getString(i);
            if (!collision[i].matches("[01]{32}")) throw new IOException("Ungültige Kollisionsdaten");
        }
        spawnX=meta.getJSONArray("spawn").getInt(0); spawnY=meta.getJSONArray("spawn").getInt(1);
        if (!walkable(spawnX,spawnY)) throw new IOException("Startpunkt ist blockiert");
        JSONArray trainers = meta.getJSONArray("trainers");
        if (trainers.length()<2 || trainers.length()>16) throw new IOException("Trainerauswahl fehlt");
        sheets=new Bitmap[trainers.length()]; names=new String[sheets.length]; roles=new String[sheets.length];
        for (int i=0;i<sheets.length;i++) {
            JSONObject trainer=trainers.getJSONObject(i);
            names[i]=trainer.getString("name"); roles[i]=trainer.getString("role");
            sheets[i]=bitmap(required(files,trainer.getString("file")),128,128);
        }
    }
    boolean walkable(int x,int y) { return x>=0 && x<32 && y>=0 && y<32 && collision[y].charAt(x)=='0'; }
    private static byte[] required(Map<String,byte[]> files,String name) throws IOException {
        byte[] data=files.get(name); if(data==null)throw new IOException("Datei fehlt: "+name); return data;
    }
    private static Bitmap bitmap(byte[] bytes,int width,int height) throws IOException {
        BitmapFactory.Options options=new BitmapFactory.Options(); options.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
        if(options.outWidth!=width || options.outHeight!=height)throw new IOException("Ungültiges Bildformat");
        options.inJustDecodeBounds=false;options.inScaled=false;options.inPreferredConfig=Bitmap.Config.ARGB_8888;
        Bitmap result=BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
        if(result==null)throw new IOException("Bild konnte nicht gelesen werden");return result;
    }
}
