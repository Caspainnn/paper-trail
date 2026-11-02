"""Local deployment: venv, dependencies, build, loopback server, browser."""
import argparse,json,os,socket,subprocess,sys,time,venv,webbrowser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);parser.add_argument('--no-open',action='store_true');parser.add_argument('--skip-install',action='store_true');parser.add_argument('--index-url');parser.add_argument('--isolated-pip',action='store_true');args=parser.parse_args()
    if sys.version_info<(3,11):raise SystemExit('Python 3.11 or newer is required')
    os.chdir(ROOT);runtime=ROOT/'.runtime';runtime.mkdir(exist_ok=True)
    if args.skip_install:python=Path(sys.executable)
    else:
        env=ROOT/'.venv';python=env/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
        if not python.exists():venv.EnvBuilder(with_pip=True).create(env)
        command=[str(python),'-m','pip']+(['--isolated'] if args.isolated_pip else [])+['install','--timeout','20','--retries','1','-r','requirements.txt']
        if args.index_url:command+=['--index-url',args.index_url]
        try:subprocess.run(command,check=True)
        except subprocess.CalledProcessError:raise SystemExit('Dependency installation failed. Check network/proxy/index settings. See README troubleshooting; no project content was removed.')
    subprocess.run([str(python),str(ROOT/'readings/论文阅读/网页/build.py')],check=True)
    for port in range(args.port,min(args.port+30,65536)):
        with socket.socket() as sock:
            try:sock.bind(('127.0.0.1',port))
            except OSError:continue
            break
    else:raise SystemExit('No available local port')
    log=(runtime/'server.log').open('ab')
    options={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {'start_new_session':True}
    server=subprocess.Popen([str(python),'-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(ROOT)],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,**options);log.close()
    url=f'http://127.0.0.1:{port}/index.html'
    import urllib.request
    for _ in range(50):
        if server.poll() is not None:raise SystemExit('Server failed; see .runtime/server.log')
        try:
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(url,timeout=1) as response:assert response.status==200
            break
        except OSError:time.sleep(.1)
    else:server.terminate();raise SystemExit('Local server did not become ready')
    (runtime/'server.json').write_text(json.dumps({'pid':server.pid,'url':url,'port':port},indent=2),encoding='utf-8')
    if not args.no_open:webbrowser.open(url)
    print('PaperTrail ready: '+url)
    print('Server PID: '+str(server.pid)+'; runtime details: .runtime/server.json')
if __name__=='__main__':main()
