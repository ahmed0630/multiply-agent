from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from tool import get_web_content, scrape_url
from dotenv import load_dotenv
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
import os


# Load env early (tool.py also does this, but ensure vars are available)
load_dotenv()


def get_llm():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment")
    return ChatGroq(model="llama-3.1-8b-instant", temperature=0.4, max_tokens=1000, api_key=api_key)


class SimpleAgent:
    def __init__(self, llm_model, tool):
        self.llm = llm_model
        self.tool = tool

    def invoke(self, data):
        messages = data.get("messages", [])
        if messages:
            user_message = messages[-1][1]
        else:
            user_message = ""

        try:
            result = self.tool.invoke(user_message)
        except Exception as e:
            result = f"Error: {str(e)}"

        return {
            "messages": [
                HumanMessage(content=user_message),
                AIMessage(content=result)
            ]
        }


#1agent

def bulid_serch_agent():
    return SimpleAgent(None, get_web_content)


#2 agent

def build_scrape_agent():
    return SimpleAgent(None, scrape_url)




def writer_invoke(topic: str, research: str):
    writer_prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert research writer. Write clear, structured and insightful reports."),
        ("human", """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual and professional.""")
    ])
    parser = StrOutputParser()
    llm = get_llm()
    chain = writer_prompt | llm | parser
    return chain.invoke({"topic": topic, "research": research})


def critic_invoke(report: str):
    critic_prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a sharp and constructive research critic. Be honest and specific."),
        ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
...""")
    ])
    parser = StrOutputParser()
    llm = get_llm()
    chain = critic_prompt | llm | parser
    return chain.invoke({"report": report})