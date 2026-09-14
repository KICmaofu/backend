document.addEventListener('DOMContentLoaded', function() {
    const chatBody = document.getElementById('chat-body');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');

    // 自动调整输入框高度
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // 发送消息
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message === '') return;

        // 添加用户消息到聊天窗口
        addMessage('user', message);
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // 显示正在输入状态
        showTypingIndicator();

        // 模拟发送消息到服务器
        setTimeout(() => {
            // 移除正在输入状态
            removeTypingIndicator();
            
            // 模拟响应数据
            const mockData = {
                code: 200,
                data: {
                    choices: [
                        {
                            message: {
                                content: '根据本地服务器中机器人的历史断电日志，含时间、持续时长、前序状态，预测下次断电的预计发生时间，并说明主要依据？根据本地服务器中“机器人_01号”的历史断电日志（共7次记录），我对下次断电时间预测如下：预测结果预计下次断电发生时间：2026年4月22日 17:30 ± 1小时（基于最近一次48小时间隔规律外推）主要依据1. 时间间隔分析日志显示的最近7次断电时间：4月5日 15:304月7日 9:27 （间隔：1天17小时57分，约42小时）4月10日 13:31 （间隔：3天4小时4分，约76小时）4月12日 17:29 （间隔：2天3小时58分，约52小时）4月15日 19:32 （间隔：3天2小时3分，约74小时）4月17日 15:28 （间隔：1天19小时56分，约44小时）4月20日 17:30 （间隔：3天2小时2分，约74小时）规律总结：不存在严格的48小时周期，但间隔呈现 “短（~44h）、长（~74h）”交替的模式。最近两次间隔：4/17→4/20 为 74小时，根据交替模式，下一次应为 短间隔（~44小时）。但从4/20 17:30 加上44小时，得到 4月22日 13:30。观察历史中“短间隔”后的时间点通常比前一次推迟约2小时，因此修正为 4月22日 17:30。2. 持续时长特征每次断电持续 4–7 秒（平均 5.2 秒），属于短暂断电，排除电池耗尽，更符合供电切换或继电器瞬时断开。持续时长未出现延长趋势，说明问题未恶化。3. 前序状态一致性断电前 30 秒的日志状态均为：电量 78%–82%任务状态：待机或低负载巡检无异常温度或电流报警排除过载或过热触发保护，支持“外部供电波动或定时切换”假说。4. 无随机打断事件4月21日全天（今天至今）未发生断电，且日志中无系统重启、手动干预记录，未打断现有模式。'
                            }
                        }
                    ]
                }
            };
            
            if (mockData.code === 200 && mockData.data.choices && mockData.data.choices.length > 0) {
                const botMessage = mockData.data.choices[0].message.content;
                addMessage('bot', botMessage);
            } else {
                addMessage('bot', '根据本地服务器中机器人的历史断电日志，含时间、持续时长、前序状态，预测下次断电的预计发生时间，并说明主要依据？根据本地服务器中“机器人_01号”的历史断电日志（共7次记录），我对下次断电时间预测如下：预测结果预计下次断电发生时间：2026年4月22日 17:30 ± 1小时（基于最近一次48小时间隔规律外推）主要依据1. 时间间隔分析日志显示的最近7次断电时间：4月5日 15:304月7日 9:27 （间隔：1天17小时57分，约42小时）4月10日 13:31 （间隔：3天4小时4分，约76小时）4月12日 17:29 （间隔：2天3小时58分，约52小时）4月15日 19:32 （间隔：3天2小时3分，约74小时）4月17日 15:28 （间隔：1天19小时56分，约44小时）4月20日 17:30 （间隔：3天2小时2分，约74小时）规律总结：不存在严格的48小时周期，但间隔呈现 “短（~44h）、长（~74h）”交替的模式。最近两次间隔：4/17→4/20 为 74小时，根据交替模式，下一次应为 短间隔（~44小时）。但从4/20 17:30 加上44小时，得到 4月22日 13:30。观察历史中“短间隔”后的时间点通常比前一次推迟约2小时，因此修正为 4月22日 17:30。2. 持续时长特征每次断电持续 4–7 秒（平均 5.2 秒），属于短暂断电，排除电池耗尽，更符合供电切换或继电器瞬时断开。持续时长未出现延长趋势，说明问题未恶化。3. 前序状态一致性断电前 30 秒的日志状态均为：电量 78%–82%任务状态：待机或低负载巡检无异常温度或电流报警排除过载或过热触发保护，支持“外部供电波动或定时切换”假说。4. 无随机打断事件4月21日全天（今天至今）未发生断电，且日志中无系统重启、手动干预记录，未打断现有模式。');
            }
        }, 3000);
    }

    // 添加消息到聊天窗口
    function addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        chatBody.appendChild(messageDiv);
        
        // 滚动到底部
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // 显示正在输入状态
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            typingDiv.appendChild(dot);
        }
        
        chatBody.appendChild(typingDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // 移除正在输入状态
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // 发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);

    // 回车键发送消息
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});