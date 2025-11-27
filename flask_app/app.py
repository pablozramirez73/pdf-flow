import os
import csv
import io
import openpyxl
import xlrd
import logging
import time
from logging.handlers import RotatingFileHandler
from pypdf import PdfReader, PdfWriter
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory, g
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

# Configure logging
if not os.path.exists('logs'):
    os.mkdir('logs')

file_handler = RotatingFileHandler('logs/app.log', maxBytes=10240, backupCount=10)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)

app = Flask(__name__)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('PDF Flow startup')

@app.before_request
def before_request():
    g.start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(g, 'start_time'):
        duration = time.time() - g.start_time
        app.logger.info(
            f"{request.remote_addr} - {request.method} {request.path} "
            f"{response.status_code} - {duration:.4f}s"
        )
    return response

app.secret_key = 'supersecretkey' # Change this in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///employees.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PDF_UPLOAD_FOLDER'] = os.path.join(app.config['UPLOAD_FOLDER'], 'pdfs')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PDF_UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50))
    surname = db.Column(db.String(100))
    name = db.Column(db.String(100))
    fiscal_code = db.Column(db.String(16))
    hiring_date = db.Column(db.Date, nullable=True)
    termination_date = db.Column(db.Date, nullable=True)
    job_title = db.Column(db.String(100))
    birth_place = db.Column(db.String(100))
    birth_date = db.Column(db.Date, nullable=True)
    email = db.Column(db.String(120))
    courses = db.relationship('TrainingCourse', backref='employee', lazy=True)

class TrainingCourse(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    date = db.Column(db.Date, nullable=True)
    place = db.Column(db.String(200))
    event_name = db.Column(db.String(200))
    ecm_credits = db.Column(db.String(50))
    pdf_filename = db.Column(db.String(200), nullable=True)

def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str.date()
    if not isinstance(date_str, str) or not date_str.strip():
        return None
    try:
        # Try DD/MM/YYYY first
        return datetime.strptime(date_str.strip(), '%d/%m/%Y').date()
    except ValueError:
        try:
            # Try YYYY-MM-DD (HTML5 date input format)
            return datetime.strptime(date_str.strip(), '%Y-%m-%d').date()
        except ValueError:
            return None

with app.app_context():
    db.create_all()

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part', 'danger')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No selected file', 'danger')
            return redirect(request.url)
        if file:
            try:
                stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
                csv_input = csv.DictReader(stream, delimiter=';')
                count = 0
                for row in csv_input:
                    employee = Employee(
                        code=row.get('Dipendente'),
                        surname=row.get('Cognome'),
                        name=row.get('Nome'),
                        fiscal_code=row.get('Codice fiscale'),
                        hiring_date=parse_date(row.get('Data assunzione')),
                        termination_date=parse_date(row.get('Data cessazione')),
                        job_title=row.get('Mansione').strip() if row.get('Mansione') else None,
                        birth_place=row.get('Dati di nascita - Localita').strip() if row.get('Dati di nascita - Localita') else None,
                        birth_date=parse_date(row.get('Data di nascita')),
                        email=row.get('Domicilio fis./Residenza - E-mail').strip() if row.get('Domicilio fis./Residenza - E-mail') else None
                    )
                    db.session.add(employee)
                    count += 1
                db.session.commit()
                flash(f'Successfully uploaded {count} employees!', 'success')
            except Exception as e:
                flash(f'Error processing file: {str(e)}', 'danger')
            return redirect(url_for('index'))
    
    employees = Employee.query.all()
    return render_template('index.html', employees=employees)

@app.route('/edit/<int:id>', methods=['GET', 'POST'])
def edit_employee(id):
    employee = Employee.query.get_or_404(id)
    if request.method == 'POST':
        employee.code = request.form['code']
        employee.surname = request.form['surname']
        employee.name = request.form['name']
        employee.fiscal_code = request.form['fiscal_code']
        employee.hiring_date = parse_date(request.form['hiring_date'])
        employee.termination_date = parse_date(request.form['termination_date'])
        employee.job_title = request.form['job_title']
        employee.birth_place = request.form['birth_place']
        employee.birth_date = parse_date(request.form['birth_date'])
        employee.email = request.form['email']
        
        try:
            db.session.commit()
            flash('Employee updated successfully!', 'success')
            return redirect(url_for('index'))
        except Exception as e:
            flash(f'Error updating employee: {str(e)}', 'danger')
            
    return render_template('edit.html', employee=employee)

@app.route('/delete/<int:id>', methods=['POST'])
def delete_employee(id):
    employee = Employee.query.get_or_404(id)
    try:
        db.session.delete(employee)
        db.session.commit()
        flash('Employee deleted successfully!', 'success')
    except Exception as e:
        flash(f'Error deleting employee: {str(e)}', 'danger')
    return redirect(url_for('index'))

@app.route('/training')
def training_list():
    employees = Employee.query.all()
    return render_template('training_list.html', employees=employees)

@app.route('/training/<int:employee_id>', methods=['GET', 'POST'])
def employee_training(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part', 'danger')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No selected file', 'danger')
            return redirect(request.url)
        if file and (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
            try:
                count = 0
                if file.filename.endswith('.xlsx'):
                    wb = openpyxl.load_workbook(file)
                    ws = wb.active
                    
                    # Start reading from row 6
                    for row in ws.iter_rows(min_row=6, values_only=True):
                        # A=Date, B=Place, C=Event, D=Credits
                        if not row[0]: # Skip empty rows
                            continue
                            
                        course = TrainingCourse(
                            employee_id=employee.id,
                            date=parse_date(row[0]),
                            place=row[1],
                            event_name=row[2],
                            ecm_credits=str(row[3]) if row[3] else None
                        )
                        db.session.add(course)
                        count += 1
                
                elif file.filename.endswith('.xls'):
                    # Save file temporarily because xlrd needs a file path or file contents
                    file_content = file.read()
                    wb = xlrd.open_workbook(file_contents=file_content)
                    sheet = wb.sheet_by_index(0)
                    
                    # Start reading from row 6 (index 5)
                    for row_idx in range(5, sheet.nrows):
                        row = sheet.row_values(row_idx)
                        # A=Date, B=Place, C=Event, D=Credits
                        if not row[0]: # Skip empty rows
                            continue
                        
                        # Handle date from xlrd (returns float)
                        date_val = row[0]
                        if isinstance(date_val, float):
                            date_tuple = xlrd.xldate_as_tuple(date_val, wb.datemode)
                            date_obj = datetime(*date_tuple[:3]).date()
                        else:
                            date_obj = parse_date(date_val)

                        course = TrainingCourse(
                            employee_id=employee.id,
                            date=date_obj,
                            place=row[1],
                            event_name=row[2],
                            ecm_credits=str(row[3]) if row[3] else None
                        )
                        db.session.add(course)
                        count += 1

                db.session.commit()
                flash(f'Successfully imported {count} courses!', 'success')
            except Exception as e:
                flash(f'Error processing file: {str(e)}', 'danger')
            return redirect(url_for('employee_training', employee_id=employee.id))
            
    # Filter courses
    query = TrainingCourse.query.filter_by(employee_id=employee_id)
    
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if start_date:
        try:
            s_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(TrainingCourse.date >= s_date)
        except ValueError:
            pass # Ignore invalid date format
            
    if end_date:
        try:
            e_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(TrainingCourse.date <= e_date)
        except ValueError:
            pass # Ignore invalid date format
            
    courses = query.order_by(TrainingCourse.date.desc()).all()
            
    return render_template('employee_training.html', employee=employee, courses=courses)

@app.route('/training/course/<int:course_id>/upload_pdf', methods=['POST'])
def upload_course_pdf(course_id):
    course = TrainingCourse.query.get_or_404(course_id)
    if 'pdf' not in request.files:
        flash('No file part', 'danger')
        return redirect(url_for('employee_training', employee_id=course.employee_id))
    file = request.files['pdf']
    if file.filename == '':
        flash('No selected file', 'danger')
        return redirect(url_for('employee_training', employee_id=course.employee_id))
    if file and file.filename.lower().endswith('.pdf'):
        filename = secure_filename(f"course_{course.id}_{file.filename}")
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        course.pdf_filename = filename
        db.session.commit()
        flash('PDF uploaded successfully!', 'success')
    else:
        flash('Invalid file type. Please upload a PDF.', 'danger')
    return redirect(url_for('employee_training', employee_id=course.employee_id))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/pdfs')
def pdf_dashboard():
    pdf_files = []
    if os.path.exists(app.config['PDF_UPLOAD_FOLDER']):
        pdf_files = [f for f in os.listdir(app.config['PDF_UPLOAD_FOLDER']) if f.lower().endswith('.pdf')]
    return render_template('pdf_dashboard.html', pdf_files=pdf_files)

@app.route('/pdfs/upload', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        flash('No file part', 'danger')
        return redirect(url_for('pdf_dashboard'))
    file = request.files['pdf']
    if file.filename == '':
        flash('No selected file', 'danger')
        return redirect(url_for('pdf_dashboard'))
    if file and file.filename.lower().endswith('.pdf'):
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['PDF_UPLOAD_FOLDER'], filename))
        flash('PDF uploaded successfully!', 'success')
    else:
        flash('Invalid file type. Please upload a PDF.', 'danger')
    return redirect(url_for('pdf_dashboard'))

@app.route('/pdfs/view/<filename>')
def view_pdf(filename):
    return send_from_directory(app.config['PDF_UPLOAD_FOLDER'], filename)

@app.route('/pdfs/delete/<filename>', methods=['POST'])
def delete_pdf(filename):
    try:
        os.remove(os.path.join(app.config['PDF_UPLOAD_FOLDER'], filename))
        flash('PDF deleted successfully!', 'success')
    except Exception as e:
        flash(f'Error deleting PDF: {str(e)}', 'danger')
    return redirect(url_for('pdf_dashboard'))

@app.route('/pdfs/merge', methods=['POST'])
def merge_pdfs():
    selected_files = request.form.getlist('selected_pdfs')
    if len(selected_files) < 2:
        flash('Please select at least 2 PDFs to merge.', 'warning')
        return redirect(url_for('pdf_dashboard'))
    
    merger = PdfWriter()
    try:
        for filename in selected_files:
            merger.append(os.path.join(app.config['PDF_UPLOAD_FOLDER'], filename))
        
        output_filename = f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(app.config['PDF_UPLOAD_FOLDER'], output_filename)
        merger.write(output_path)
        merger.close()
        flash(f'PDFs merged successfully into {output_filename}!', 'success')
    except Exception as e:
        flash(f'Error merging PDFs: {str(e)}', 'danger')
    
    return redirect(url_for('pdf_dashboard'))

@app.route('/pdfs/split/<filename>', methods=['GET', 'POST'])
def split_pdf(filename):
    file_path = os.path.join(app.config['PDF_UPLOAD_FOLDER'], filename)
    if not os.path.exists(file_path):
        flash('File not found.', 'danger')
        return redirect(url_for('pdf_dashboard'))
        
    if request.method == 'POST':
        mode = request.form.get('mode')
        try:
            reader = PdfReader(file_path)
            base_name = os.path.splitext(filename)[0]
            
            if mode == 'single':
                page_num = int(request.form.get('page_number')) - 1 # 0-indexed
                if 0 <= page_num < len(reader.pages):
                    writer = PdfWriter()
                    writer.add_page(reader.pages[page_num])
                    output_filename = f"{base_name}_page_{page_num + 1}.pdf"
                    writer.write(os.path.join(app.config['PDF_UPLOAD_FOLDER'], output_filename))
                    flash(f'Page {page_num + 1} extracted successfully!', 'success')
                else:
                    flash('Invalid page number.', 'danger')
                    
            elif mode == 'range':
                start_page = int(request.form.get('start_page')) - 1
                end_page = int(request.form.get('end_page')) - 1
                
                if 0 <= start_page <= end_page < len(reader.pages):
                    writer = PdfWriter()
                    for i in range(start_page, end_page + 1):
                        writer.add_page(reader.pages[i])
                    output_filename = f"{base_name}_pages_{start_page + 1}-{end_page + 1}.pdf"
                    writer.write(os.path.join(app.config['PDF_UPLOAD_FOLDER'], output_filename))
                    flash(f'Pages {start_page + 1}-{end_page + 1} extracted successfully!', 'success')
                else:
                    flash('Invalid page range.', 'danger')
            
            return redirect(url_for('pdf_dashboard'))
            
        except Exception as e:
            flash(f'Error splitting PDF: {str(e)}', 'danger')
            return redirect(url_for('split_pdf', filename=filename))

    # GET request - show split form
    try:
        reader = PdfReader(file_path)
        num_pages = len(reader.pages)
        return render_template('pdf_split.html', filename=filename, num_pages=num_pages)
    except Exception as e:
        flash(f'Error reading PDF: {str(e)}', 'danger')
        return redirect(url_for('pdf_dashboard'))

@app.route('/about')
def about():
    return render_template('about.html')

if __name__ == '__main__':
    app.run(debug=True)

