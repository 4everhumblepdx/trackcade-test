import io,json,unittest
from isolate_stage1_reference_v1 import IsolationError,inspect_prefix,isolate_stage1_value,RangeByteSource
META={'eventKind':'drop','labelScope':'expert Drop timestamps only; Build/Break are not evaluation targets','schema':'trackcade-semantic-external-drop-references-v3'}
ROWS=[{'id':f'synthetic-{n}','dropsSeconds':[1.0+n]} for n in range(50)]
class PoisonReader:
    def __init__(self,data,stop):self.data=data;self.stop=stop;self.offset=0
    def read(self,n):
        assert n==1
        if self.offset>=self.stop:raise AssertionError('poisoned terminal/suffix read')
        b=self.data[self.offset:self.offset+1];self.offset+=1;return b
class Tests(unittest.TestCase):
    def fixture(self,rows=ROWS):
        head=json.dumps(META)[:-1]+',"stage1":';value=json.dumps(rows);tail=',"terminal":["POISON_NEVER_READ"]}'
        return (head+value+tail).encode(),len((head+value).encode())
    def test_stops_exactly_at_stage1_end(self):
        data,end=self.fixture();r=PoisonReader(data,end);inspect_prefix(r);raw,rows=isolate_stage1_value(r);self.assertEqual(rows,ROWS);self.assertEqual(r.offset,end)
    def test_trailing_poison_need_not_even_be_valid_json(self):
        data,end=self.fixture();r=PoisonReader(data[:end]+b'POISON',end);inspect_prefix(r);self.assertEqual(isolate_stage1_value(r)[1],ROWS)
    def test_terminal_first_fails_before_value(self):
        head=b'{"terminal"';r=PoisonReader(head+b':"POISON", "stage1":[]}',len(head))
        with self.assertRaises(IsolationError):inspect_prefix(r)
    def test_unknown_key_fails_before_value(self):
        head=b'{"unexpected"';r=PoisonReader(head+b':"POISON"}',len(head))
        with self.assertRaises(IsolationError):inspect_prefix(r)
    def test_preflight_stops_at_colon_before_labels(self):
        head=(json.dumps(META)[:-1]+',"stage1":').encode();r=PoisonReader(head+b'POISON',len(head));inspect_prefix(r);self.assertEqual(r.offset,len(head))
    def test_string_brackets_escapes_do_not_end_array(self):
        rows=[{'id':f'quote\\\"]}}{n}','dropsSeconds':[]} for n in range(50)];data,end=self.fixture(rows);r=PoisonReader(data,end);inspect_prefix(r);self.assertEqual(isolate_stage1_value(r)[1],rows)
    def test_wrong_metadata_fails(self):
        with self.assertRaises(IsolationError):inspect_prefix(io.BytesIO(b'{"schema":"wrong"}'))
    def test_bad_stage1_count_fails_without_suffix(self):
        data,end=self.fixture([]);r=PoisonReader(data,end);inspect_prefix(r)
        with self.assertRaises(IsolationError):isolate_stage1_value(r)
    def test_range_rejects_whole_response_without_reading_body(self):
        class Response:
            status=200
            def getheader(self,k):return None
            def read(self,n):raise AssertionError('body read')
        class Connection:
            def request(self,*a,**k):pass
            def getresponse(self):return Response()
            def close(self):pass
        s=RangeByteSource('/synthetic',1,'etag');s.connection.close();s.connection=Connection()
        with self.assertRaises(IsolationError):s.read(1)
        self.assertEqual(s.offset,0)
if __name__=='__main__':unittest.main(verbosity=2)
