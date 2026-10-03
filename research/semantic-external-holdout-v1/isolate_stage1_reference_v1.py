"""Strict Stage1-only streaming isolation. Never consume a terminal value."""
import http.client,json,re

class IsolationError(ValueError):pass

class RangeByteSource:
    def __init__(self,path,total,etag,offset=0):
        self.path=path;self.total=total;self.etag=etag;self.offset=offset;self.requests=0
        self.connection=http.client.HTTPSConnection('raw.githubusercontent.com',timeout=30)
    def read(self,n):
        if n!=1:raise IsolationError('only one-byte reads allowed')
        if self.offset>=self.total:raise IsolationError('unexpected EOF')
        self.connection.request('GET',self.path,headers={'Range':f'bytes={self.offset}-{self.offset}','Accept-Encoding':'identity','User-Agent':'TrackCade-Stage1-isolation-v1'})
        response=self.connection.getresponse()
        if response.status!=206 or response.getheader('Content-Range')!=f'bytes {self.offset}-{self.offset}/{self.total}' or response.getheader('Content-Length')!='1' or response.getheader('ETag')!=self.etag or response.getheader('Content-Encoding') not in [None,'identity']:
            self.connection.close();raise IsolationError('range identity/length/etag mismatch; body unread')
        data=response.read(1)
        if len(data)!=1:raise IsolationError('short range')
        self.offset+=1;self.requests+=1
        return data
    def close(self):self.connection.close()

def byte(source):
    value=source.read(1)
    if not isinstance(value,bytes) or len(value)!=1:raise IsolationError('short or oversized byte read')
    return value

def nonspace(source):
    while True:
        value=byte(source)
        if value not in b' \t\r\n':return value

def string(source,first=None):
    if (first or nonspace(source))!=b'"':raise IsolationError('expected JSON string')
    out=bytearray(b'"');escape=False
    while True:
        value=byte(source);out.extend(value)
        if escape:escape=False
        elif value==b'\\':escape=True
        elif value==b'"':return json.loads(out)
        if len(out)>2048:raise IsolationError('oversized metadata string')

def inspect_prefix(source):
    if nonspace(source)!=b'{':raise IsolationError('expected root object')
    allowed={'eventKind':'drop','labelScope':'expert Drop timestamps only; Build/Break are not evaluation targets','schema':'trackcade-semantic-external-drop-references-v3'}
    seen={}
    while True:
        key=string(source)
        # Reject before reading the value or its delimiter. No unknown field may hide labels.
        if key=='terminal':raise IsolationError('terminal before Stage1; value unread')
        if key=='stage1':
            if seen!=allowed:raise IsolationError('metadata prefix mismatch')
            if nonspace(source)!=b':':raise IsolationError('missing Stage1 colon')
            return seen
        if key not in allowed or key in seen:raise IsolationError('unknown/duplicate field before Stage1; value unread')
        if nonspace(source)!=b':':raise IsolationError('missing metadata colon')
        value=string(source)
        if value!=allowed[key]:raise IsolationError('metadata value mismatch')
        seen[key]=value
        if nonspace(source)!=b',':raise IsolationError('missing metadata comma')

def isolate_stage1_value(source):
    first=nonspace(source)
    if first!=b'[':raise IsolationError('Stage1 must be array')
    out=bytearray(first);stack=[b'['];inside=False;escape=False
    while stack:
        value=byte(source);out.extend(value)
        if inside:
            if escape:escape=False
            elif value==b'\\':escape=True
            elif value==b'"':inside=False
        elif value==b'"':inside=True
        elif value in [b'[',b'{']:stack.append(value)
        elif value in [b']',b'}']:
            if stack[-1]!=(b'[' if value==b']' else b'{'):raise IsolationError('unbalanced Stage1 container')
            stack.pop()
        if len(out)>20000:raise IsolationError('Stage1 size envelope exceeded')
    # No separator, suffix, EOF check or terminal byte is read after the final ].
    rows=json.loads(out)
    if not isinstance(rows,list) or len(rows)!=50:raise IsolationError('Stage1 must have 50 rows')
    return bytes(out),rows
