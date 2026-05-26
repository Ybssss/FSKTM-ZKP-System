import shutil
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from io import BytesIO
from pathlib import Path


DOCX_PATH = Path(r"D:\STUDY\fyp\fyp2\Chapters\compiled c1-c4  psm1.docx")
BACKUP_PATH = DOCX_PATH.with_name(
    f"{DOCX_PATH.stem}.backup-chapter6-format-{datetime.now():%Y%m%d-%H%M%S}{DOCX_PATH.suffix}"
)
TMP_PATH = DOCX_PATH.with_suffix(".tmp.docx")

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"


def q(tag):
    return f"{{{W_NS}}}{tag}"


with zipfile.ZipFile(DOCX_PATH, "r") as zin:
    document_xml = zin.read("word/document.xml")
    for _, namespace in ET.iterparse(BytesIO(document_xml), events=["start-ns"]):
        ET.register_namespace(namespace[0], namespace[1])
    root = ET.fromstring(document_xml)

ns = {"w": W_NS}
body = root.find("w:body", ns)
if body is None:
    raise RuntimeError("Could not find document body.")


def text_of(element):
    return "".join((t.text or "") for t in element.findall(".//w:t", ns)).strip()


def make_paragraph(text="", bold=False, page_break_before=False):
    paragraph = ET.Element(q("p"))
    if page_break_before:
        properties = ET.SubElement(paragraph, q("pPr"))
        ET.SubElement(properties, q("pageBreakBefore"))

    run = ET.SubElement(paragraph, q("r"))
    if bold:
        run_properties = ET.SubElement(run, q("rPr"))
        ET.SubElement(run_properties, q("b"))

    text_node = ET.SubElement(run, q("t"))
    text_node.text = text
    if text[:1].isspace() or text[-1:].isspace() or "\t" in text:
        text_node.set(f"{{{XML_NS}}}space", "preserve")
    return paragraph


children = list(body)
start_index = None
end_index = None

for index, child in enumerate(children):
    if child.tag == q("p") and text_of(child) in {"Chapter 6", "CHAPTER 6 CONCLUSION"}:
        start_index = index
        break

if start_index is None:
    raise RuntimeError("Could not find Chapter 6 start.")

for index in range(start_index + 1, len(children)):
    child = children[index]
    if child.tag == q("p") and text_of(child) == "REFERENCES":
        end_index = index
        break

if end_index is None:
    raise RuntimeError("Could not find REFERENCES after Chapter 6.")

chapter6 = [
    ("CHAPTER 6 CONCLUSION", True, True),
    ("6.1\tIntroduction", True, False),
    ("This chapter summarizes the development results of the Zero-Knowledge Proof-Based Authentication for Passwordless Login in a Web-Based Evaluation System for UTHM FSKTM Postgraduate Research Symposium. It explains how the completed system achieved the project objectives, identifies the advantages and current limitations of the system, and proposes future implementation plans to further improve usability, security, scalability, and institutional readiness.", False, False),
    ("6.2\tSystem Development Result", True, False),
    ("The system successfully delivers the main features required by administrators, panel members, and postgraduate students. Administrators can manage users, create rubrics where the rubric acts as the session type, assign panels, perform AI-assisted expertise matching, create batches, schedule sessions, detect scheduling conflicts, edit session details, monitor evaluations, approve historical access requests, and export batch schedules. Panel members can view assigned sessions, access student materials, submit rubric-based evaluations, review completed evaluation records, request historical feedback access, and manage attendance through QR/PIN verification. Students can update research information, view schedules, upload session materials, mark attendance, and view finalized official evaluation reports.", False, False),
    ("The completed prototype also supports important security and continuity requirements. ZKP-based passwordless authentication removes the need for traditional password submission during login. JWT-protected API routes, role-based access control, device validation, controlled historical feedback permissions, locked completed evaluations, and protected file-view tickets help restrict sensitive academic records to authorized users. Functionality testing and User Acceptance Testing confirmed that the system can digitize the manual Word/email-based symposium workflow, reduce repeated administrative effort, improve evaluation traceability, and preserve feedback continuity across sessions.", False, False),
    ("6.3\tAdvantages and Disadvantages", True, False),
    ("Key Advantages:", True, False),
    ("i.\tComplete digitization of the postgraduate symposium evaluation workflow, reducing dependence on scattered Word files, email attachments, and manual record compilation.", False, False),
    ("ii.\tImproved security through ZKP-based passwordless login, JWT session protection, role-based access control, trusted device validation, and protected file viewing.", False, False),
    ("iii.\tBetter evaluation continuity through the Historical Feedback Vault, searchable official student reports, permission-controlled access requests, and preserved panel comments.", False, False),
    ("iv.\tMore reliable scheduling through batch-first session creation, one-student-one-session-per-day validation, two-panel assignment, and overlapping panel time conflict detection.", False, False),
    ("v.\tGreater administrative support through AI-assisted panel matching based on stored expertise tags, batch export tools, attendance monitoring, and centralized session management.", False, False),
    ("Current Limitations:", True, False),
    ("i.\tThe system is not yet integrated with official UTHM identity, student information, supervisor, calendar, or notification systems, so data still needs to be managed inside the application.", False, False),
    ("ii.\tDeployment on free-tier cloud services may cause cold starts, resource limits, email-provider restrictions, and slower response during high-usage periods.", False, False),
    ("iii.\tThe ZKP recovery process still depends on users keeping their backup file or trusted device safe, so user training and clear recovery procedures remain important.", False, False),
    ("iv.\tAI matching accuracy depends on the completeness of stored panel expertise tags and the availability of the configured Gemini API service.", False, False),
    ("v.\tThe system is browser responsive but does not yet include a native mobile application, push notification channel, or full production-scale automated test suite.", False, False),
    ("6.4\tFuture Implementation", True, False),
    ("To build on the current success of the system, several enhancements are planned for future implementation. Institutional integration should be introduced so user accounts, student programme information, supervisors, active enrolment records, and staff identities can be synchronized from official UTHM systems. This would reduce duplicate data entry and make the platform more reliable for real faculty-wide use.", False, False),
    ("A notification and reminder module should also be added. The system can support in-app alerts, email reminders, and calendar integration for upcoming sessions, evaluation deadlines, pending historical access requests, attendance windows, and incomplete panel evaluations. Google Calendar or Outlook calendar export would be useful because panel members already rely on calendar tools to manage symposium commitments.", False, False),
    ("Further improvements can focus on reporting, analytics, and administrative oversight. Official student reports can be expanded with downloadable PDF versions, digital signature sections, archived report versions, and programme-level summaries. Admin dashboards can include evaluation completion rates, average panel turnaround time, attendance rates, conflict frequency, and historical access activity. A stronger audit log can also record important actions such as user changes, rubric updates, file access, unlock approvals, and withdrawn permissions.", False, False),
    ("From the technical perspective, future implementation should include automated unit, integration, and end-to-end testing, production monitoring, scheduled database backups, stronger file virus scanning, and refined rate limiting. The AI matching module can be improved with richer panel expertise profiles, workload balancing, editable recommendation reasons, and clearer comparison between AI recommendations and deterministic scoring. The platform can also be generalized for other faculties by supporting configurable session stages, rubric templates, terminology, and approval workflows.", False, False),
    ("6.5\tConclusion", True, False),
    ("The ZKP-based FSKTM Postgraduate Research Symposium Evaluation System has successfully established a secure digital foundation for managing symposium evaluations. It addresses critical weaknesses in the previous manual workflow by centralizing records, reducing scheduling errors, protecting sensitive evaluation materials, preserving historical feedback continuity, and enabling students to view official finalized reports. The system also demonstrates how passwordless authentication and controlled access workflows can be applied practically in an academic evaluation environment.", False, False),
    ("Overall, the project achieved its main objectives by designing, developing, and evaluating a role-based web platform for administrators, panel members, and postgraduate students. The planned future improvements will help transform the prototype into a more complete institutional platform with stronger integration, automation, analytics, and production readiness. By improving the system step by step, FSKTM can continue to modernize postgraduate research evaluation while maintaining data privacy, academic accountability, and operational efficiency.", False, False),
]

for index in range(end_index - 1, start_index - 1, -1):
    body.remove(children[index])

for offset, (text, bold, page_break) in enumerate(chapter6):
    body.insert(start_index + offset, make_paragraph(text, bold, page_break))

new_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True)
shutil.copy2(DOCX_PATH, BACKUP_PATH)

with zipfile.ZipFile(DOCX_PATH, "r") as zin, zipfile.ZipFile(
    TMP_PATH, "w", zipfile.ZIP_DEFLATED
) as zout:
    for info in zin.infolist():
        data = new_xml if info.filename == "word/document.xml" else zin.read(info.filename)
        zout.writestr(info, data)

TMP_PATH.replace(DOCX_PATH)
print(f"Updated Chapter 6 format in: {DOCX_PATH}")
print(f"Backup created: {BACKUP_PATH}")
