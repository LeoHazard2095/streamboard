#!/usr/bin/env python3
"""Inspect only M3U metadata; does not download or rebroadcast video segments."""
from __future__ import annotations
import argparse
from collections import Counter
import json
import re
import urllib.request
from urllib.parse import urlsplit

DEFAULT = 'https://livetgtv.lovable.app/api/public/playlist.m3u'
ATTR = re.compile(r'([\w-]+)\s*=\s*"([^"]*)"')

def inspect(text: str) -> dict:
    headers=text.replace('\ufeff', '').splitlines()
    if not headers or not headers[0].lstrip().startswith('#EXTM3U'):
        raise ValueError('Response is not an M3U playlist (possible HTML/login or proxy error)')
    categories, languages, hosts=Counter(),Counter(),Counter()
    total=logos=tvg_ids=hls_urls=0
    urls=set(); pending=None
    for raw in headers:
        line=raw.strip()
        if line.startswith('#EXTINF:'):
            attrs=dict((k.lower(),v) for k,v in ATTR.findall(line))
            pending={'category':attrs.get('group-title','Unknown') or 'Unknown',
                     'language':attrs.get('tvg-language','Unknown') or 'Unknown',
                     'logo':bool(attrs.get('tvg-logo')),'tvg_id':bool(attrs.get('tvg-id'))}
        elif line.startswith('#') or not line:
            continue
        elif pending and line.startswith(('http://','https://')):
            total+=1
            categories[pending['category']]+=1
            languages[pending['language']]+=1
            try:hosts[urlsplit(line).hostname or 'unknown']+=1
            except ValueError:pass
            logos+=pending['logo']; tvg_ids+=pending['tvg_id']; hls_urls+=('.m3u8' in line.lower())
            urls.add(line)
            pending=None
    return {'channel_entries':total,'unique_url_count':len(urls),
            'entries_with_logo':logos,'entries_with_tvg_id':tvg_ids,
            'urls_containing_m3u8':hls_urls,
            'groups':dict(categories.most_common(30)),
            'languages_in_metadata':dict(languages.most_common(20)),
            'top_stream_hosts':dict(hosts.most_common(20)),
            'warning':'These are metadata counts, not proof streams are currently live or authorized.'}

def main():
    parser=argparse.ArgumentParser(description='Inspect a public M3U catalog without requesting video streams')
    parser.add_argument('url',nargs='?',default=DEFAULT)
    args=parser.parse_args()
    req=urllib.request.Request(args.url,headers={'User-Agent':'StreamBoard-PlaylistInspector/1.1.1',
        'Accept':'application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain,*/*'})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            if response.status!=200:raise ValueError(f'Playlist HTTP {response.status}')
            raw=response.read(8_000_001)
            if len(raw)>8_000_000:raise ValueError('Playlist exceeds safe 8 MB limit')
            report=inspect(raw.decode('utf-8-sig',errors='replace'))
            report['source_url']=args.url
            print(json.dumps(report,ensure_ascii=False,indent=2))
    except Exception as exc:
        print(json.dumps({'source_url':args.url,'error':str(exc),
            'note':'Source may be unavailable, access-limited, or returning non-M3U content.'},indent=2))
        raise SystemExit(1)

if __name__=='__main__':main()
