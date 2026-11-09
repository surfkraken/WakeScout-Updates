#!/usr/bin/env python3
"""Collect recent lake-specific headlines. Unverified coverage, never safety clearance."""
import datetime as dt, email.utils, json, pathlib, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
NAMES={
"bear-lake":"Bear Lake Utah","deer-creek":"Deer Creek Reservoir Utah","east-canyon":"East Canyon Reservoir Utah","echo":"Echo Reservoir Utah","flaming-gorge":"Flaming Gorge Reservoir Utah","gunlock":"Gunlock Reservoir Utah","huntington":"Huntington Reservoir Utah","hyrum":"Hyrum Reservoir Utah","jordanelle":"Jordanelle Reservoir Utah","lake-powell":"Lake Powell","millsite":"Millsite Reservoir Utah","otter-creek":"Otter Creek Reservoir Utah","pineview":"Pineview Reservoir Utah","piute":"Piute Reservoir Utah","quail-creek":"Quail Creek Reservoir Utah","red-fleet":"Red Fleet Reservoir Utah","rockport":"Rockport Reservoir Utah","sand-hollow":"Sand Hollow Reservoir Utah","scofield":"Scofield Reservoir Utah","starvation":"Starvation Reservoir Utah","steinaker":"Steinaker Reservoir Utah","strawberry":"Strawberry Reservoir Utah","utah-lake":"Utah Lake","willard-bay":"Willard Bay Utah","yuba":"Yuba Reservoir Utah"}
KEYWORDS=re.compile(r"\\b(ris(?:e|es|ing)|rose|feet|level|water|reservoir|ramp|launch|closure|closed|algae|bloom|hazard|flood|boating|boat|marina|drawdown|spillway|drought|contamination|e\\.?\\s*coli|storm|restriction|access)\\b",re.I)
BLOCK=re.compile(r"\\b(fishing report|fishing tournament|real estate|home prices|basketball|football|vacation rental|restaurant|hiking guide)\\b",re.I)
def fetch(name):
    q='"'+name+'" (water level OR boat ramp OR boating OR closure OR algae OR reservoir) when:14d'
    url="https://news.google.com/rss/search?"+urllib.parse.urlencode({"q":q,"hl":"en-US","gl":"US","ceid":"US:en"})
    req=urllib.request.Request(url,headers={"User-Agent":"WakeScout Lake Intel/1.0"})
    with urllib.request.urlopen(req,timeout=15) as response:
        return ET.fromstring(response.read(750000))
def collect(now):
    result={"schemaVersion":1,"generatedAt":now.isoformat().replace("+00:00","Z"),"source":"Google News RSS headlines (unverified)","lakes":{}}
    for lake,name in NAMES.items():
        try:
            root=fetch(name)
            entries=[]
            for item in root.findall(".//channel/item"):
                title=(item.findtext("title") or "").strip()
                link=(item.findtext("link") or "").strip()
                source=(item.findtext("source") or "").strip()
                published=item.findtext("pubDate") or ""
                try: date=email.utils.parsedate_to_datetime(published).astimezone(dt.timezone.utc)
                except (ValueError,TypeError):continue
                if not (now-dt.timedelta(days=14)<=date<=now+dt.timedelta(hours=1)):continue
                if not KEYWORDS.search(title) or BLOCK.search(title):continue
                # Exact lake phrase required to prevent similarly named lakes from leaking across regions.
                lake_term=re.sub(r"\\s+Utah$","",name,flags=re.I)
                if not re.search(r"(?<!\\w)"+re.escape(lake_term)+r"(?!\\w)",title,re.I):continue
                u=urllib.parse.urlparse(link)
                if u.scheme!="https" or u.hostname not in ("news.google.com","www.google.com"):continue
                entries.append({"title":title[:220],"url":link,"publisher":source[:90],"publishedAt":date.isoformat().replace("+00:00","Z")})
            dedup={}
            for e in entries:dedup.setdefault(re.sub(r"[^a-z0-9]+","",e["title"].lower())[:90],e)
            result["lakes"][lake]={"status":"ok","items":sorted(dedup.values(),key=lambda x:x["publishedAt"],reverse=True)[:5]}
        except Exception as exc:
            print(f"{lake}: source unavailable ({type(exc).__name__})")
            result["lakes"][lake]={"status":"unavailable","items":[]}
    return result
if __name__=="__main__":
    now=dt.datetime.now(dt.timezone.utc)
    path=ROOT/"data"/"lake-intel-coverage.json"
    path.write_text(json.dumps(collect(now),indent=2,ensure_ascii=False)+"\\n")
