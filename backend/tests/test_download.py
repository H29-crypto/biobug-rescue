import base64
import hashlib
import io
import pytest
from connectome import download


def source_for(content):
    return {'filename':'metadata.json','url':'https://storage.googleapis.com/example/metadata.json',
            'generation':'123456','size_bytes':len(content),
            'md5_base64':base64.b64encode(hashlib.md5(content).digest()).decode()}


def test_download_pins_generation_verifies_and_reuses_cache(tmp_path,monkeypatch):
    content=b'{"dataset":"male-cns","tag":"v1.0"}'
    source=source_for(content)
    requests=[]
    def open_url(url,timeout):
        requests.append(url)
        return io.BytesIO(content)
    monkeypatch.setattr(download.urllib.request,'urlopen',open_url)
    result=download.download_file(source,tmp_path)
    assert requests==[source['url']+'?generation=123456']
    assert result['verified'] is True and result['sha256']==hashlib.sha256(content).hexdigest()
    assert (tmp_path/source['filename']).read_bytes()==content
    assert not (tmp_path/(source['filename']+'.part')).exists()
    download.download_file(source,tmp_path)
    assert len(requests)==1


def test_bad_download_never_becomes_a_valid_cached_file(tmp_path,monkeypatch):
    source=source_for(b'good')
    monkeypatch.setattr(download.urllib.request,'urlopen',lambda *args,**kwargs:io.BytesIO(b'evil'))
    monkeypatch.setattr(download.time,'sleep',lambda _:None)
    with pytest.raises(ValueError,match='Checksum'):
        download.download_file(source,tmp_path)
    assert not (tmp_path/source['filename']).exists()
    assert not (tmp_path/(source['filename']+'.part')).exists()
