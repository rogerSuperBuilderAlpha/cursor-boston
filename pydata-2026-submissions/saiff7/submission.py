#!/usr/bin/env python
# coding: utf-8

# In[1]:


get_ipython().system('pip install pandas folium requests mediapipe opencv-python pyautogui numpy flask -q')


# In[8]:


import requests, pandas as pd, io, ssl, warnings
import numpy as np
warnings.filterwarnings("ignore")
ssl._create_default_https_context = ssl._create_unverified_context

def get_boston_data(resource_id, label=""):
    api = f"https://data.boston.gov/api/3/action/resource_show?id={resource_id}"
    resp = requests.get(api, verify=False).json()
    if not resp.get("success"):
        print(f"[{label}] FAILED:", resp.get("error"))
        return None
    url = resp["result"]["url"]
    print(f"[{label}] Fetching:", url)
    r = requests.get(url, verify=False)
    return pd.read_csv(io.StringIO(r.text), low_memory=False)

crime  = get_boston_data("b973d8cb-eeb2-4e7e-99da-c92938efc9c0", "crime")
vision = get_boston_data("e4bfe397-6bfc-49c5-9367-c879fac7401d", "vision_crash")

# Schools — correct resource ID
schools = get_boston_data("0046426a-9e5b-4c66-9c49-dee0e7d1875a", "schools")
if schools is None:
    # fallback: skip schools gracefully
    schools = pd.DataFrame(columns=['lat','lon','name'])
    print("Schools dataset unavailable, skipping.")

print("crime:", crime.shape, "| vision:", vision.shape, "| schools:", schools.shape)
print("\nCrime cols:", crime.columns.tolist())
print("Vision cols:", vision.columns.tolist())
print("Schools cols:", schools.columns.tolist())


# In[9]:


# --- Clean crime ---
crime = crime.dropna(subset=['Lat','Long'])
crime = crime[(crime['Lat'] > 42.2) & (crime['Lat'] < 42.5)]
crime = crime[(crime['Long'] > -71.2) & (crime['Long'] < -70.9)]

severity_map = {
    'Homicide':10,'Robbery':8,'Aggravated Assault':8,'Sex Offender':9,
    'Simple Assault':6,'Burglary':7,'Auto Theft':5,'Drug Violation':5,
    'Larceny':4,'Vandalism':3,'Trespassing':2,'Other':2
}
crime['severity'] = crime['OFFENSE_CODE_GROUP'].map(severity_map).fillna(2)

# --- District safety score (no sklearn) ---
ds = crime.groupby('DISTRICT').agg(
    crime_count=('INCIDENT_NUMBER','count'),
    avg_severity=('severity','mean')
).reset_index()
ds['raw_risk'] = ds['crime_count'] * ds['avg_severity']
mn, mx = ds['raw_risk'].min(), ds['raw_risk'].max()
ds['risk_norm'] = (ds['raw_risk'] - mn) / (mx - mn) * 100
ds['safety_score'] = (100 - ds['risk_norm']).round(1)
ds = ds.sort_values('safety_score', ascending=False).reset_index(drop=True)

# --- Clean vision ---
lat_col = next(c for c in vision.columns if 'lat' in c.lower())
lon_col = next(c for c in vision.columns if 'lon' in c.lower())
vision  = vision.dropna(subset=[lat_col, lon_col]).copy()
vision  = vision.rename(columns={lat_col:'lat', lon_col:'lon'})

# --- Clean schools ---
s_lat = next((c for c in schools.columns if 'lat' in c.lower()), None)
s_lon = next((c for c in schools.columns if 'lon' in c.lower()), None)
if s_lat and s_lon:
    schools = schools.dropna(subset=[s_lat, s_lon]).copy()
    schools = schools.rename(columns={s_lat:'lat', s_lon:'lon'})

print(ds[['DISTRICT','crime_count','safety_score']].to_string())


# In[10]:


import plotly.express as px

fig = px.bar(
    ds, x='DISTRICT', y='safety_score',
    title='🏙️ Boston District Safety Scores (Higher = Safer)',
    color='safety_score',
    color_continuous_scale=['#FF3333','#FFAA00','#00FF88'],
    text='safety_score',
    template='plotly_dark'
)
fig.update_traces(texttemplate='%{text:.0f}', textposition='outside')
fig.update_layout(font=dict(size=14), coloraxis_showscale=False, height=500)
fig.show()


# In[11]:


import folium
from folium.plugins import HeatMap, MarkerCluster, MiniMap

m = folium.Map(location=[42.3601,-71.0589], zoom_start=13,
               tiles='CartoDB dark_matter', control_scale=True)

# --- Layer 1: Crime Heatmap ---
crime_layer = folium.FeatureGroup(name="🔴 Crime Heatmap", show=True)
heat_data = crime[['Lat','Long','severity']].values.tolist()
HeatMap(heat_data, radius=14, blur=20,
        gradient={0.2:'blue',0.45:'lime',0.7:'orange',1.0:'red'},
        min_opacity=0.4).add_to(crime_layer)
crime_layer.add_to(m)

# --- Layer 2: Vision Zero Crash Concerns ---
vision_layer = folium.FeatureGroup(name="⚠️ Crash Concerns", show=False)
cluster = MarkerCluster().add_to(vision_layer)
for _, row in vision.head(500).iterrows():
    folium.CircleMarker(
        location=[row['lat'], row['lon']],
        radius=5, color='#FFA500', fill=True,
        fill_color='#FFA500', fill_opacity=0.7,
        popup=str(row.get('mode_type', row.get('request_type','Concern')))
    ).add_to(cluster)
vision_layer.add_to(m)

# --- Layer 3: Schools ---
if s_lat:
    school_layer = folium.FeatureGroup(name="🏫 Schools", show=False)
    for _, row in schools.iterrows():
        folium.Marker(
            location=[row['lat'], row['lon']],
            icon=folium.Icon(color='blue', icon='education', prefix='glyphicon'),
            popup=str(row.get('School_Name', row.get('name','School')))
        ).add_to(school_layer)
    school_layer.add_to(m)

# --- Layer 4: District Safety Bubbles ---
district_coords = {
    'A1':[42.3600,-71.0589],'A7':[42.3820,-71.0300],'A15':[42.3890,-71.0150],
    'B2':[42.3230,-71.0870],'B3':[42.3020,-71.0780],'C6':[42.3380,-71.0480],
    'C11':[42.3050,-71.0550],'D4':[42.3450,-71.0750],'D14':[42.3480,-71.1350],
    'E5':[42.2900,-71.1200],'E13':[42.2980,-71.0650],'E18':[42.2750,-71.1250],
}
score_layer = folium.FeatureGroup(name="🟢 District Safety Score", show=True)
for _, row in ds.iterrows():
    coords = district_coords.get(row['DISTRICT'])
    if not coords: continue
    score = row['safety_score']
    color = '#00FF88' if score > 60 else '#FFAA00' if score > 35 else '#FF3333'
    folium.CircleMarker(
        location=coords, radius=int(score/5)+10,
        color=color, fill=True, fill_color=color, fill_opacity=0.5,
        tooltip=f"District {row['DISTRICT']} — Safety: {score}/100",
        popup=folium.Popup(
            f"<b>District {row['DISTRICT']}</b><br>"
            f"Safety Score: <b>{score}/100</b><br>"
            f"Total Crimes: {row['crime_count']}<br>"
            f"Avg Severity: {row['avg_severity']:.2f}",
            max_width=220)
    ).add_to(score_layer)
score_layer.add_to(m)

# --- Legend ---
legend = """
<div style="position:fixed;bottom:40px;left:40px;z-index:9999;
background:#111;padding:16px;border-radius:12px;color:white;
font-family:monospace;border:1px solid #444;font-size:13px;">
<b>🗺️ Boston Safety Map</b><br><br>
<span style="color:#00FF88">●</span> Safe District (&gt;60)<br>
<span style="color:#FFAA00">●</span> Moderate Risk (35–60)<br>
<span style="color:#FF3333">●</span> High Risk (&lt;35)<br>
<span style="color:#FFA500">●</span> Crash Concern<br>
<span style="color:#4488FF">●</span> School<br><br>
<i>Bubble size = safety score</i>
</div>"""
m.get_root().html.add_child(folium.Element(legend))

MiniMap(toggle_display=True, tile_layer='CartoDB dark_matter').add_to(m)
folium.LayerControl(collapsed=False).add_to(m)

m.save("boston_safety_map.html")
print("✅ Map saved → boston_safety_map.html")


# In[12]:


# Step 1 — Download hand_landmarker.task model
import urllib.request, os
model_path = "hand_landmarker.task"
if not os.path.exists(model_path):
    print("Downloading hand_landmarker.task...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
        model_path
    )
    print("✅ Downloaded!")
else:
    print("✅ Model already exists")


# In[2]:


import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np, time, threading, webbrowser, os, pyautogui

pyautogui.PAUSE = 0
os.environ["GLOG_minloglevel"] = "2"

webbrowser.open(f"file://{os.path.abspath('boston_safety_map.html')}")
time.sleep(2)

base_options = python.BaseOptions(model_asset_path='hand_landmarker.task')
options = mp_vision.HandLandmarkerOptions(
    base_options=base_options, num_hands=2,
    min_hand_detection_confidence=0.7,
    min_hand_presence_confidence=0.7,
    min_tracking_confidence=0.7,
    running_mode=mp_vision.RunningMode.VIDEO
)
detector = mp_vision.HandLandmarker.create_from_options(options)

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

TIPS = [8,12,16,20]; PIPS = [6,10,14,18]
CONNECTIONS = [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),
               (5,9),(9,10),(10,11),(11,12),(9,13),(13,14),(14,15),(15,16),
               (13,17),(17,18),(18,19),(19,20),(0,17)]

def draw_hand(frame, lm, w, h, color):
    for c in CONNECTIONS:
        cv2.line(frame,(int(lm[c[0]].x*w),int(lm[c[0]].y*h)),
                       (int(lm[c[1]].x*w),int(lm[c[1]].y*h)),color,2)
    for p in lm:
        cv2.circle(frame,(int(p.x*w),int(p.y*h)),4,(255,255,255),-1)

def palm_dist(lm1, lm2):
    return np.sqrt((lm1[0].x-lm2[0].x)**2 + (lm1[0].y-lm2[0].y)**2)

def do_zoom(direction):
    if direction == 'in':
        pyautogui.hotkey('command', '=')
    else:
        pyautogui.hotkey('command', '-')

prev_dist=None; last_zoom=0; timestamp_ms=0
ZOOM_THRESHOLD=0.04; ZOOM_COOLDOWN=0.5
zoom_label=""; zoom_timer=0

print("\n✅ Gesture Zoom Active!")
print("   🤏 Palms TOGETHER → Zoom IN")
print("   🤲 Palms APART    → Zoom OUT")
print("   Press Q to quit\n")

while True:
    ok, frame = cap.read()
    if not ok: break
    frame = cv2.flip(frame,1)
    fh,fw = frame.shape[:2]

    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB,
                      data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    timestamp_ms += 33
    result = detector.detect_for_video(mp_img, timestamp_ms)
    lms = result.hand_landmarks
    if zoom_timer > 0: zoom_timer -= 1

    if lms and len(lms) == 2:
        draw_hand(frame, lms[0], fw, fh, (0,200,255))
        draw_hand(frame, lms[1], fw, fh, (255,100,0))

        dist = palm_dist(lms[0], lms[1])
        w0=(int(lms[0][0].x*fw),int(lms[0][0].y*fh))
        w1=(int(lms[1][0].x*fw),int(lms[1][0].y*fh))
        cv2.line(frame,w0,w1,(0,255,200),2)
        cv2.putText(frame,f"dist: {dist:.3f}",(10,fh-15),
                    cv2.FONT_HERSHEY_SIMPLEX,0.6,(180,180,180),1)

        now = time.time()
        if prev_dist and (now - last_zoom) > ZOOM_COOLDOWN:
            delta = dist - prev_dist
            if abs(delta) > ZOOM_THRESHOLD:
                direction = 'out' if delta > 0 else 'in'
                threading.Thread(target=do_zoom,args=(direction,),daemon=True).start()
                zoom_label = "🔎 ZOOM OUT" if direction=='out' else "🔍 ZOOM IN"
                zoom_timer = 60; last_zoom = now
                print(zoom_label)
        prev_dist = dist

        bg = (0,80,0) if "IN" in zoom_label and zoom_timer>0 else \
             (80,0,0) if "OUT" in zoom_label and zoom_timer>0 else (20,20,20)
        cv2.rectangle(frame,(0,0),(fw,50),bg,-1)
        cv2.putText(frame, zoom_label if zoom_timer>0 else "👐 BOTH HANDS DETECTED",
                    (10,35),cv2.FONT_HERSHEY_SIMPLEX,0.9,(255,255,255),2)
    else:
        prev_dist = None
        cv2.rectangle(frame,(0,0),(fw,50),(30,30,30),-1)
        cv2.putText(frame,msg,(10,35),cv2.FONT_HERSHEY_SIMPLEX,0.8,(120,200,255),2)

    cv2.imshow("Boston Map Gesture Zoom — Q to quit", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release(); detector.close(); cv2.destroyAllWindows()
print("👋 Done.")


# In[ ]:





# In[ ]:




