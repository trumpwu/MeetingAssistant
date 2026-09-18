using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace MeetingAssistantLauncher
{
    public class MainForm : Form
    {
        private Label lblStatus;
        private ProgressBar progressBar;
        private System.Windows.Forms.Timer timer;
        private int retryCount = 0;

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        public MainForm()
        {
            this.Text = "AI 智慧會議助理 - 啟動中";
            this.Size = new Size(420, 200);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(248, 250, 252);
            this.Icon = SystemIcons.Application;

            Label lblTitle = new Label();
            lblTitle.Text = "🎙️ AI 智慧會議記錄助理";
            lblTitle.Font = new Font("Microsoft JhengHei UI", 12, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(79, 70, 229);
            lblTitle.Location = new Point(20, 20);
            lblTitle.Size = new Size(360, 28);
            this.Controls.Add(lblTitle);

            lblStatus = new Label();
            lblStatus.Text = "正在載入本地端 AI 核心與會議服務...";
            lblStatus.Font = new Font("Microsoft JhengHei UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(100, 116, 139);
            lblStatus.Location = new Point(22, 55);
            lblStatus.Size = new Size(360, 24);
            this.Controls.Add(lblStatus);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 30;
            progressBar.Location = new Point(22, 85);
            progressBar.Size = new Size(360, 20);
            this.Controls.Add(progressBar);

            this.Load += MainForm_Load;
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            Thread bgThread = new Thread(StartServicesAndLaunch);
            bgThread.IsBackground = true;
            bgThread.Start();
        }

        private void StartServicesAndLaunch()
        {
            try
            {
                string appDir = @"D:\project\MeetingAssistant";
                string batFile = Path.Combine(appDir, "AI智慧會議助理.bat");

                UpdateStatus("正在啟動 AI 智慧會議記錄助理...");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = string.Format("/c \"{0}\"", batFile);
                psi.WorkingDirectory = appDir;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;

                Process p = Process.Start(psi);
                p.WaitForExit();

                Thread.Sleep(500);
                this.Invoke(new Action(() => this.Close()));
            }
            catch (Exception ex)
            {
                MessageBox.Show("啟動時發生錯誤：" + ex.Message, "錯誤", MessageBoxButtons.OK, MessageBoxIcon.Error);
                this.Invoke(new Action(() => this.Close()));
            }
        }

        private void UpdateStatus(string text)
        {
            if (this.IsHandleCreated)
            {
                this.Invoke(new Action(() => { lblStatus.Text = text; }));
            }
        }

        private bool IsPortOpen(string host, int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(300);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private bool IsWebReady(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 800;
                req.Method = "GET";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
